#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "/Users/shreyansh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const appUrl = process.env.LAUNCHPAD_URL ?? "http://127.0.0.1:3401/";
const outputDir = path.resolve(process.argv[2] ?? ".local/video/real-capture");
const fast = process.env.CAPTURE_FAST === "1";
const hold = async (page, milliseconds) => {
  await page.waitForTimeout(fast ? Math.min(milliseconds, 900) : milliseconds);
};

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: outputDir,
    size: { width: 1920, height: 1080 },
  },
});
const page = await context.newPage();
const markers = [];
const started = Date.now();
const mark = (name) => markers.push({ name, seconds: (Date.now() - started) / 1000 });

await page.goto(appUrl, { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: "Creator Pulse", exact: true }).waitFor();
mark("launchpad-workroom");
await hold(page, 12000);

const history = page.getByRole("combobox", { name: "Run history" });
const threeAgentOption = history.locator("option").filter({ hasText: "3 Agents" }).first();
if (await threeAgentOption.count()) {
  await history.selectOption(await threeAgentOption.getAttribute("value"));
  await page.waitForTimeout(800);
}
mark("three-agent-run");
await hold(page, 16000);

await page.getByRole("button", { name: "Agent map" }).click();
mark("coordination-map");
await hold(page, 17000);

await page.getByRole("button", { name: "Raw ledger" }).click();
const stoppedEvent = page.getByText("Runtime terminated", { exact: true }).first();
if (await stoppedEvent.count()) await stoppedEvent.scrollIntoViewIfNeeded();
mark("raw-ledger-recovery");
await hold(page, 23000);

const twoAgentOption = history.locator("option").filter({ hasText: "2 Agents" }).first();
if (await twoAgentOption.count()) {
  await history.selectOption(await twoAgentOption.getAttribute("value"));
  await page.waitForTimeout(800);
}
mark("two-agent-remediation");
await hold(page, 16000);

await page.getByRole("button", { name: "Workroom" }).click();
mark("independent-pass");
await hold(page, 18000);

await page.getByRole("button", { name: "Raw ledger" }).click();
const blockedEvent = page.getByText("Action blocked", { exact: true }).last();
if (await blockedEvent.count()) await blockedEvent.scrollIntoViewIfNeeded();
mark("bouncer-and-proof-gate");
await hold(page, 18000);

const resultLink = page.getByRole("link", { name: /Open result/ }).first();
const resultUrl = await resultLink.getAttribute("href");
if (!resultUrl) throw new Error("Open result link is missing");
await page.goto(new URL(resultUrl, appUrl).href, { waitUntil: "domcontentloaded" });
mark("real-result");
await hold(page, 12000);

for (const name of ["Storytelling", "Tech", "Comedy"]) {
  const button = page.getByRole("button", { name });
  if (await button.count()) await button.click();
}
const combine = page.getByRole("button", { name: /Combine themes/ });
if (await combine.count() && await combine.isEnabled()) {
  await combine.click();
  await hold(page, 1500);
}
mark("result-interaction");
await hold(page, 3500);

const hookB = page.getByRole("button", { name: "Choose Hook B", exact: true });
if (!await hookB.count()) throw new Error("Hook B choice is missing from the live result");
await hookB.click();
await hold(page, 2500);

const saveFavourite = page.getByRole("button", { name: "Save favourite", exact: true });
if (!await saveFavourite.count()) throw new Error("Save favourite is missing from the live result");
await saveFavourite.click();
mark("winner-and-favourite");
await hold(page, 3500);

await page.reload({ waitUntil: "domcontentloaded" });
await page.getByText("HOOK B", { exact: true }).first().waitFor();
mark("result-reloaded");
await hold(page, 5000);

const video = page.video();
await page.close();
await context.close();
await browser.close();

const videoPath = await video.path();
markers.push({ name: "capture-end", seconds: (Date.now() - started) / 1000 });
await writeFile(path.join(outputDir, "markers.json"), `${JSON.stringify({ appUrl, videoPath, markers }, null, 2)}\n`);
console.log(JSON.stringify({ videoPath, markers }, null, 2));
