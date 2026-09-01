#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "/Users/shreyansh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const outputDir = path.resolve(process.argv[2] ?? ".local/video/result-cursor");
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: outputDir, size: { width: 1920, height: 1080 } },
});
const page = await context.newPage();
await page.addInitScript(() => {
  const install = () => {
    const cursor = document.createElement("div");
    cursor.style.cssText = "position:fixed;left:0;top:0;width:24px;height:24px;border:4px solid white;border-radius:50%;background:#ff2d78;box-shadow:0 0 0 3px #111827,0 4px 18px #000a;pointer-events:none;z-index:2147483647;transform:translate(-50%,-50%)";
    document.documentElement.appendChild(cursor);
    document.addEventListener("mousemove", e => { cursor.style.left=`${e.clientX}px`; cursor.style.top=`${e.clientY}px`; }, true);
    document.addEventListener("mousedown", () => { cursor.style.width="42px"; cursor.style.height="42px"; cursor.style.background="#ffd400"; }, true);
    document.addEventListener("mouseup", () => { cursor.style.width="24px"; cursor.style.height="24px"; cursor.style.background="#ff2d78"; }, true);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install); else install();
});
const hold = ms => page.waitForTimeout(ms);
const click = async locator => {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("Click target missing");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
  await hold(350); await page.mouse.down(); await hold(180); await page.mouse.up(); await hold(650);
};

await page.goto("http://127.0.0.1:3401/api/agents/49d105f3-ccad-4759-b807-91bf3e21410e/preview/", { waitUntil: "domcontentloaded" });
await hold(1200);
for (const name of ["Storytelling", "Tech", "Comedy"]) await click(page.getByRole("button", { name }));
await click(page.getByRole("button", { name: /Combine themes/ }));
await hold(1200);
await click(page.getByRole("button", { name: "Choose Hook B", exact: true }));
await hold(900);
await click(page.getByRole("button", { name: "Save favourite", exact: true }));
await hold(1300);
await page.reload({ waitUntil: "domcontentloaded" });
await hold(900);
await page.getByText("Favourites", { exact: true }).scrollIntoViewIfNeeded();
await hold(3500);
const video = page.video();
await page.close(); await context.close(); await browser.close();
console.log(await video.path());
