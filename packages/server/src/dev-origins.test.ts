import { expect, test } from 'vitest';
import { devOrigins } from './dev-origins.ts';

test('preview origins require explicit loopback configuration', () => {
  expect(devOrigins('').has('http://127.0.0.1:5395')).toBe(false);
  const origins = devOrigins('http://127.0.0.1:5395, http://localhost:5395/');
  expect(origins.has('http://127.0.0.1:5395')).toBe(true);
  expect(origins.has('http://localhost:5395')).toBe(true);
  expect(origins.has('http://localhost:5190')).toBe(true);
});

test('preview configuration cannot allow remote, credentialed or non-origin URLs', () => {
  const origins = devOrigins('https://evil.test,http://localhost.evil.test:5395,http://user:pass@localhost:5395,http://localhost:5395/path,http://localhost:5395?x=1,not a URL');
  expect([...origins]).toEqual(['http://localhost:5190', 'http://127.0.0.1:5190']);
});
