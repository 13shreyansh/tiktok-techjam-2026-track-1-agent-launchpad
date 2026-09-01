#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "/Users/shreyansh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const outputDir = path.resolve(process.argv[2] ?? ".local/video/action-proof");
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: outputDir, size: { width: 1920, height: 1080 } },
});
const page = await context.newPage();
await page.addInitScript(() => {
  const install = () => {
    if (document.getElementById("__demo_cursor")) return;
    const cursor = document.createElement("div");
    cursor.id = "__demo_cursor";
    cursor.style.cssText = [
      "position:fixed", "left:0", "top:0", "width:24px", "height:24px",
      "border:4px solid #ffffff", "border-radius:50%", "background:#ff2d78",
      "box-shadow:0 0 0 3px #111827,0 4px 18px rgba(0,0,0,.65)",
      "pointer-events:none", "z-index:2147483647", "transform:translate(-50%,-50%)",
      "transition:width .12s,height .12s,background .12s",
    ].join(";");
    document.documentElement.appendChild(cursor);
    document.addEventListener("mousemove", (event) => {
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
    }, true);
    document.addEventListener("mousedown", () => {
      cursor.style.width = "42px";
      cursor.style.height = "42px";
      cursor.style.background = "#ffd400";
    }, true);
    document.addEventListener("mouseup", () => {
      cursor.style.width = "24px";
      cursor.style.height = "24px";
      cursor.style.background = "#ff2d78";
    }, true);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
});
const started = Date.now();
const markers = [];
const mark = (name) => markers.push({ name, seconds: (Date.now() - started) / 1000 });
const hold = (milliseconds) => page.waitForTimeout(milliseconds);
const humanClick = async (locator) => {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("Visible click target is missing");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 22 });
  await hold(700);
  await page.mouse.down();
  await hold(220);
  await page.mouse.up();
};

await page.goto("http://127.0.0.1:3401/", { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: "Creator Pulse", exact: true }).waitFor();
await humanClick(page.getByRole("button", { name: "Workroom", exact: true }));
mark("launchpad-ready");
await hold(2500);

const prompt = "Improve the existing TikTok creator tool: generate two competing video hooks, let the creator choose a winner, save favourites, and independently verify the result. Choose the smallest useful team.";
const composer = page.locator('textarea[placeholder^="Describe what you want"]');
await composer.scrollIntoViewIfNeeded();
await humanClick(composer);
await page.keyboard.type(prompt, { delay: 11 });
mark("prompt-visible");
await hold(4500);
await humanClick(page.getByRole("button", { name: "Send message" }));
mark("prompt-submitted");

await page.getByText("Launchpad is coordinating the work", { exact: true }).waitFor({ timeout: 120000 });
await hold(2500);

const secondRuntime = page.getByText(/started checkpoint 2 of \d+/).last();
try {
  await secondRuntime.waitFor({ timeout: 180000 });
  mark("implementation-runtime-started");
} catch {
  await page.getByText("Agent Runtime started", { exact: true }).last().waitFor({ timeout: 30000 });
  mark("active-runtime-started");
}

await humanClick(page.getByRole("button", { name: "Agent map", exact: true }));
mark("team-map-visible");
await hold(8000);

await humanClick(page.getByRole("button", { name: "Workroom", exact: true }));
const runtimeStarted = page.getByText("Agent Runtime started", { exact: true }).last();
if (await runtimeStarted.count()) await runtimeStarted.scrollIntoViewIfNeeded();
mark("live-glassbox-visible");
await hold(8000);

const killSwitch = page.getByRole("button", { name: "Kill Switch current Agent", exact: true }).first();
await killSwitch.scrollIntoViewIfNeeded();
const killBox = await killSwitch.boundingBox();
if (!killBox) throw new Error("Kill Switch is not visible");
await page.mouse.move(killBox.x + killBox.width / 2, killBox.y + killBox.height / 2, { steps: 35 });
mark("kill-switch-hover");
await hold(2500);
await page.mouse.down();
await hold(350);
await page.mouse.up();
mark("kill-switch-clicked");

await page.getByText("Runtime terminated", { exact: true }).last().waitFor({ timeout: 45000 });
await hold(1500);
await humanClick(page.getByRole("button", { name: "Raw ledger", exact: true }));
const terminated = page.getByText("Runtime terminated", { exact: true }).last();
await terminated.scrollIntoViewIfNeeded();
mark("termination-receipt-visible");
await hold(7000);

await page.reload({ waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: "Creator Pulse", exact: true }).waitFor();
mark("browser-reloaded");
await hold(6000);

const video = page.video();
await page.close();
await context.close();
await browser.close();
const videoPath = await video.path();
markers.push({ name: "capture-end", seconds: (Date.now() - started) / 1000 });
await writeFile(path.join(outputDir, "markers.json"), `${JSON.stringify({ videoPath, markers }, null, 2)}\n`);
console.log(JSON.stringify({ videoPath, markers }, null, 2));
