/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The libSQL client's Cloudflare Workers ("workerd") export condition
  // points at a file that Next's output tracer otherwise misses, which
  // breaks the OpenNext Cloudflare bundle. Force it into the traced output.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/@libsql/isomorphic-ws/**"],
  },
};

module.exports = nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
