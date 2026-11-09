import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

test("real stdio MCP lists four tools and surfaces setup required", async () => {
  const child = spawn(process.execPath, ["dist/index.js"], { cwd: new URL("..", import.meta.url), env: { ...process.env, NEAR_TESTNET_CONTRACT: "" } });
  const lines = createInterface({ input: child.stdout });
  const pending = new Map();
  lines.on("line", line => {
    const value = JSON.parse(line);
    const waiter = pending.get(value.id);
    if (waiter) { pending.delete(value.id); waiter(value); }
  });
  let id = 0;
  const request = (method, params) => new Promise((resolve, reject) => {
    const n = ++id; const timer = setTimeout(() => reject(new Error("MCP timeout")), 5000);
    pending.set(n, value => { clearTimeout(timer); resolve(value); });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: n, method, params }) + "\n");
  });
  try {
    const init = await request("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "noren-test", version: "1.0.0" } });
    assert.ok(init.result, JSON.stringify(init));
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
    const list = await request("tools/list", {});
    assert.deepEqual(list.result.tools.map(x => x.name).sort(), ["credit_status", "harvest_preview", "quote_deposit", "quote_spend"]);
    const status = await request("tools/call", { name: "credit_status", arguments: { account: "alice.testnet" } });
    assert.equal(status.result.isError, true);
    assert.match(status.result.content[0].text, /Setup required: NEAR_TESTNET_CONTRACT/);
  } finally {
    child.stdin.end(); child.kill();
  }
});

test("credit_status and harvest_preview read the live testnet contract", { skip: !process.env.NOREN_LIVE_CONTRACT && "set NOREN_LIVE_CONTRACT and NOREN_LIVE_ACCOUNT" }, async () => {
  const child = spawn(process.execPath, ["dist/index.js"], { cwd: new URL("..", import.meta.url), env: { ...process.env, NEAR_TESTNET_CONTRACT: process.env.NOREN_LIVE_CONTRACT } });
  const lines = createInterface({ input: child.stdout });
  const pending = new Map();
  lines.on("line", line => { const v = JSON.parse(line); const w = pending.get(v.id); if (w) { pending.delete(v.id); w(v); } });
  let id = 0;
  const request = (method, params) => new Promise((resolve, reject) => {
    const n = ++id; const timer = setTimeout(() => reject(new Error("MCP timeout")), 20000);
    pending.set(n, v => { clearTimeout(timer); resolve(v); });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: n, method, params }) + "\n");
  });
  try {
    await request("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "noren-test", version: "1.0.0" } });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
    const status = await request("tools/call", { name: "credit_status", arguments: { account: process.env.NOREN_LIVE_ACCOUNT } });
    assert.notEqual(status.result.isError, true, status.result.content[0].text);
    const body = JSON.parse(status.result.content[0].text);
    assert.equal(body.borrower, process.env.NOREN_LIVE_ACCOUNT);
    assert.ok(BigInt(body.collateral_usd6) > 0n && BigInt(body.debt_usd6) > 0n);
    const preview = await request("tools/call", { name: "harvest_preview", arguments: { account: process.env.NOREN_LIVE_ACCOUNT } });
    assert.notEqual(preview.result.isError, true, preview.result.content[0].text);
    assert.match(JSON.parse(preview.result.content[0].text).label, /Projection only/);
  } finally { child.stdin.end(); child.kill(); }
});
