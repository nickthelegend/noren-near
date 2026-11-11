import test from 'node:test';
import assert from 'node:assert/strict';
import { nearView, rheaRates, supportedTokens } from '../dist/index.js';

test('RPC error details are translated without exposing raw response objects', async () => {
  const fetcher = async () => new Response(JSON.stringify({ error: { data: { cause: { name: 'UNKNOWN_ACCOUNT' } } } }));
  await assert.rejects(nearView('credit.testnet', 'position', {}, undefined, fetcher), /account could not be found/);
});
test('HTTP and network failures give a bounded recovery message', async () => {
  await assert.rejects(rheaRates(async () => new Response(JSON.stringify({ error: { internal: 'raw detail' } }), { status: 503 })), /service is unavailable.*Try again/);
  await assert.rejects(supportedTokens(async (_url, init) => { assert.ok(init.signal); throw new TypeError('Failed to fetch'); }), /Check your connection and try again/);
});
