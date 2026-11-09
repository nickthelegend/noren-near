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
