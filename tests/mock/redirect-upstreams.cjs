/**
 * Preload for the Next.js server during tests (NODE_OPTIONS=--require …).
 * Sends calls for the real provider hosts to the local mock instead, so no
 * request ever leaves the machine and no real key is needed.
 */
const MOCK = process.env.MOCK_UPSTREAM_URL || 'http://127.0.0.1:54321';
const MAP = {
  'https://api.paystack.co': `${MOCK}/__paystack`,
  'https://api.qoreid.com': `${MOCK}/__qoreid`,
  'https://api.withmono.com': `${MOCK}/__mono`,
};

const realFetch = globalThis.fetch;
globalThis.fetch = function patchedFetch(input, init) {
  let url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  for (const [from, to] of Object.entries(MAP)) {
    if (url.startsWith(from)) {
      url = to + url.slice(from.length);
      return realFetch(url, typeof input === 'object' && !(input instanceof URL) ? input : init);
    }
  }
  return realFetch(input, init);
};
