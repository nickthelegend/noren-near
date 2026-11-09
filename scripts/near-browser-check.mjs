import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const require = createRequire(import.meta.url);
const { chromium } = require("/Volumes/Extreme SSD/Projects/tasteprobe/node_modules/playwright-core");
const output = resolve(root, ".near-build");
mkdirSync(output, { recursive: true });
const server = spawn(resolve(root, "packages/web/node_modules/.bin/vite"), ["preview", "--host", "127.0.0.1", "--port", "5190", "--strictPort"], {
  cwd: resolve(root, "packages/web"), stdio: "ignore",
});
let browser;
try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch("http://127.0.0.1:5190/"); if (r.ok) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  if (!ready) throw new Error("Vite preview did not start");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const results = [];
  for (const width of [1440, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("http://127.0.0.1:5190/#/near", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".near-page");
    await page.waitForFunction(() => !document.body.textContent?.includes("Live catalog: Loading"), undefined, { timeout: 15000 });
    const metrics = await page.evaluate(() => ({
      rootTextLength: document.getElementById("root")?.textContent?.trim().length ?? 0,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      innerWidth,
      setupVisible: document.body.textContent?.includes("Setup required: NEAR_MAINNET_ACCOUNT") ?? false,
      liveCatalogVisible: /Live catalog: \d+ assets/.test(document.body.textContent ?? ""),
    }));
    await page.screenshot({ path: resolve(output, `near-${width}.png`), fullPage: true });
    if (metrics.rootTextLength === 0 || errors.length || metrics.scrollWidth > metrics.innerWidth || metrics.bodyScrollWidth > metrics.innerWidth || !metrics.setupVisible || !metrics.liveCatalogVisible)
      throw new Error(`Browser gate failed at ${width}: ${JSON.stringify({ ...metrics, errors })}`);
    let liveSpendQuoteVisible = false;
    if (width === 1440) {
      await page.getByLabel("Your NEAR account").fill("intents.near");
      await page.getByLabel("Merchant address").fill("0x1111111111111111111111111111111111111111");
      await page.getByRole("button", { name: /Quote USDC payment/ }).click();
      await page.waitForSelector(".near-quote", { timeout: 20000 });
      liveSpendQuoteVisible = (await page.locator(".near-quote").innerText()).includes('"dry": true');
      if (!liveSpendQuoteVisible || errors.length) throw new Error(`Live browser spend quote failed: ${await page.locator(".near-alert").allInnerTexts()}`);
    }
    results.push({ width, ...metrics, liveSpendQuoteVisible, pageErrors: errors.length, screenshot: `.near-build/near-${width}.png` });
    await page.close();
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
