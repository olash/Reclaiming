/** @type {import('next').NextConfig} */

// Old static pages (public/*.html) → their replacements. These keep every
// bookmarked link, emailed link and OAuth/password-reset return address
// working after the move to real routes. Browsers carry the URL #fragment
// across a redirect, so sign-in tokens survive it too.
const legacy = [
  ['/index.html', '/'],
  ['/auth.html', '/login'],
  ['/dashboard.html', '/app'],
  ['/discovery-wizard.html', '/app/new'],
  ['/wizard.html', '/app/new'],
  ['/vault.html', '/app/vault'],
  ['/privacy.html', '/privacy'],
  ['/terms.html', '/terms'],
  ['/bvn-discovery.html', '/app'],
  ['/recovery-detail.html', '/app'],
  ['/bank-form-generator.html', '/app'],
  ['/success.html', '/app'],
  ['/latest.html', '/'],
];

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // QoreID's selfie check runs in an iframe from dashboard.qoreid.com and needs the camera.
  { key: 'Permissions-Policy', value: 'camera=(self "https://dashboard.qoreid.com"), geolocation=(self "https://dashboard.qoreid.com"), microphone=()' },
];

const nextConfig = {
  poweredByHeader: false,
  // Loaded with require() at runtime; keep it out of the bundle.
  experimental: { serverComponentsExternalPackages: ['@google-cloud/vision'] },
  async redirects() {
    return [
      { source: '/auth.html', has: [{ type: 'query', key: 'tab', value: 'signup' }], destination: '/signup', permanent: false },
      { source: '/recovery-detail.html', has: [{ type: 'query', key: 'id', value: '(?<id>[0-9a-fA-F-]{36})' }], destination: '/app/estates/:id', permanent: false },
      { source: '/bvn-discovery.html', has: [{ type: 'query', key: 'estate_id', value: '(?<id>[0-9a-fA-F-]{36})' }], destination: '/app/estates/:id', permanent: false },
      ...legacy.map(([source, destination]) => ({ source, destination, permanent: false })),
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

module.exports = nextConfig;
