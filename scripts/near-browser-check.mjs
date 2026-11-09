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
  const routes = [
    { hash: "#/near", ready: ".nl-coin strong", live: () => /\d+ assets on \d+ chains/.test(document.body.textContent ?? "") },
    { hash: "#/near/app", ready: ".nc-hero", live: () => /\$[\d,]+\.\d\d/.test(document.querySelector(".nc-hero b")?.textContent ?? "") },
  ];
  for (const width of [1440, 390]) for (const route of routes) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:5190/${route.hash}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(route.ready);
    await page.waitForFunction(route.live, undefined, { timeout: 20000 });
    const metrics = await page.evaluate(() => ({
      rootTextLength: document.getElementById("root")?.textContent?.trim().length ?? 0,
      scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, innerWidth,
      setupVisible: document.body.textContent?.includes("Setup required: NEAR_MAINNET_ACCOUNT") ?? false,
    }));
    const name = route.hash.replace(/[#/]+/g, "-").replace(/^-/, "");
    await page.screenshot({ path: resolve(output, `${name}-${width}.png`), fullPage: true });
    if (metrics.rootTextLength === 0 || errors.length || metrics.scrollWidth > metrics.innerWidth || metrics.bodyScrollWidth > metrics.innerWidth || !metrics.setupVisible)
      throw new Error(`Browser gate failed at ${route.hash} ${width}: ${JSON.stringify({ ...metrics, errors })}`);
    let liveSpendQuoteVisible = false;
    if (width === 1440 && route.hash === "#/near/app") {
      await page.getByRole("tab", { name: "Pay anyone" }).click();
      await page.locator("#nc-to").fill("0x1111111111111111111111111111111111111111");
      await page.getByRole("button", { name: /Get a live 1Click quote/ }).click();
      await page.waitForSelector(".nc-receipt, .nk-err", { timeout: 30000 });
      liveSpendQuoteVisible = (await page.locator(".nc-receipt").count()) > 0 && (await page.locator(".nc-receipt").innerText()).includes("dry: true");
      if (!liveSpendQuoteVisible || errors.length) throw new Error(`Live browser spend quote failed: ${await page.locator(".nk-err").allInnerTexts()}`);
    }
    results.push({ route: route.hash, width, ...metrics, liveSpendQuoteVisible, pageErrors: errors.length, screenshot: `.near-build/${name}-${width}.png` });
    await page.close();
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
