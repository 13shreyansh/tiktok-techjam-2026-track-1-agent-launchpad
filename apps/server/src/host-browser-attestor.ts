import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type {
  RelayPreviewAttestation,
  RelayPreviewViewportAttestation,
} from "./relay-types.js";

interface BrowserConsoleMessage {
  type(): string;
  text(): string;
}

interface BrowserPage {
  on(event: "console", listener: (message: BrowserConsoleMessage) => void): void;
  on(event: "pageerror", listener: (error: Error) => void): void;
  goto(url: string, options: { waitUntil: "load"; timeout: number }): Promise<unknown>;
  waitForTimeout(milliseconds: number): Promise<void>;
  evaluate<T>(expression: string): Promise<T>;
  screenshot(options: { path: string; fullPage: boolean }): Promise<unknown>;
  close(): Promise<void>;
}

interface BrowserInstance {
  newPage(options: { viewport: { width: number; height: number } }): Promise<BrowserPage>;
  close(): Promise<void>;
}

interface PlaywrightModule {
  chromium: {
    launch(options: { channel?: string; headless: boolean }): Promise<BrowserInstance>;
  };
}

interface PageMeasurement {
  bodyTextLength: number;
  headingCount: number;
  interactiveControlCount: number;
  horizontalOverflowPx: number;
}

const VIEWPORTS = [
  { name: "mobile-375" as const, width: 375, height: 812 },
  { name: "desktop-1440" as const, width: 1440, height: 900 },
];

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

async function fileExists(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

async function sha256(file: string): Promise<string> {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

function cleanError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replaceAll(/(?:[A-Za-z0-9_-]{20,})/g, "[REDACTED]")
    .slice(0, 1_000);
}

async function closeServer(server: Server | null): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function serveDirectory(rootDirectory: string): Promise<{ server: Server; url: string }> {
  const root = path.resolve(rootDirectory);
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const decodedPath = decodeURIComponent(requestUrl.pathname);
      if (decodedPath === "/favicon.ico") {
        response.writeHead(204, { "Cache-Control": "no-store" }).end();
        return;
      }
      const requestedFile = path.resolve(root, `.${decodedPath === "/" ? "/index.html" : decodedPath}`);
      const relative = path.relative(root, requestedFile);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const payload = await readFile(requestedFile);
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": CONTENT_TYPES[path.extname(requestedFile).toLowerCase()] ?? "application/octet-stream",
      });
      response.end(payload);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    await closeServer(server);
    throw new Error("Trusted-host preview server did not expose a TCP port");
  }
  return { server, url: `http://127.0.0.1:${address.port}/` };
}

export interface HostBrowserAttestorOptions {
  artifactRoot: string;
  playwrightModule: string;
  browserChannel?: string | undefined;
}

export class HostBrowserAttestor {
  constructor(private readonly options: HostBrowserAttestorOptions) {}

  async attest(workspacePath: string): Promise<RelayPreviewAttestation | null> {
    const candidates = [path.join(workspacePath, "dist", "index.html"), path.join(workspacePath, "index.html")];
    const entryFile = (await Promise.all(candidates.map(async (file) => ({ file, exists: await fileExists(file) }))))
      .find((candidate) => candidate.exists)?.file;
    if (!entryFile) return null;

    const id = randomUUID();
    const artifactDirectory = path.join(this.options.artifactRoot, id);
    await mkdir(artifactDirectory, { recursive: true });
    const attestation: RelayPreviewAttestation = {
      id,
      checkedAt: new Date().toISOString(),
      status: "failed",
      entryFile: path.relative(workspacePath, entryFile),
      browser: this.options.browserChannel || "chromium",
      viewports: [],
      failure: null,
    };

    let browser: BrowserInstance | null = null;
    let previewServer: Server | null = null;
    try {
      const specifier = path.isAbsolute(this.options.playwrightModule)
        ? pathToFileURL(this.options.playwrightModule).href
        : this.options.playwrightModule;
      const imported = (await import(specifier)) as PlaywrightModule & {
        default?: PlaywrightModule;
      };
      const playwright = imported.chromium ? imported : imported.default;
      if (!playwright?.chromium) {
        throw new Error("Configured Playwright module does not export chromium");
      }
      browser = await playwright.chromium.launch({
        ...(this.options.browserChannel ? { channel: this.options.browserChannel } : {}),
        headless: true,
      });
      const served = await serveDirectory(path.dirname(entryFile));
      previewServer = served.server;
      for (const viewport of VIEWPORTS) {
        const consoleErrors: string[] = [];
        const pageErrors: string[] = [];
        const page = await browser.newPage({ viewport });
        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(message.text().slice(0, 500));
        });
        page.on("pageerror", (error) => pageErrors.push(error.message.slice(0, 500)));
        await page.goto(served.url, { waitUntil: "load", timeout: 15_000 });
        await page.waitForTimeout(250);
        const measurement = await page.evaluate<PageMeasurement>(`(() => {
          const root = document.documentElement;
          const bodyText = document.body?.innerText || "";
          return {
            bodyTextLength: bodyText.trim().length,
            headingCount: document.querySelectorAll("h1,h2,h3,h4,h5,h6").length,
            interactiveControlCount: document.querySelectorAll("button,a[href],input,textarea,select,[role='button']").length,
            horizontalOverflowPx: Math.max(0, root.scrollWidth - root.clientWidth),
          };
        })()`);
        const screenshotFile = `${viewport.name}.png`;
        const screenshotPath = path.join(artifactDirectory, screenshotFile);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        const receipt: RelayPreviewViewportAttestation = {
          ...viewport,
          ...measurement,
          consoleErrors,
          pageErrors,
          screenshotFile,
          screenshotSha256: await sha256(screenshotPath),
        };
        attestation.viewports.push(receipt);
        await page.close();
      }
      const passed = attestation.viewports.every(
        (viewport) =>
          viewport.bodyTextLength >= 20 &&
          viewport.headingCount >= 1 &&
          viewport.horizontalOverflowPx <= 1 &&
          viewport.consoleErrors.length === 0 &&
          viewport.pageErrors.length === 0,
      );
      attestation.status = passed ? "passed" : "failed";
      attestation.failure = passed
        ? null
        : "One or more trusted-host page-load, runtime-error, heading, or horizontal-overflow checks failed";
    } catch (error) {
      attestation.failure = cleanError(error);
    } finally {
      await browser?.close().catch(() => undefined);
      await closeServer(previewServer).catch(() => undefined);
    }
    return attestation;
  }
}
