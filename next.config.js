/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Profile photos are shrunk in the browser before they're sent (see
  // PhotoInput), so they arrive at a couple of hundred KB. This is the
  // backstop for a phone that can't shrink one: the 1MB default turned an
  // ordinary camera photo into an error page. Vercel itself stops at
  // 4.5MB, so this stays under it.
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  // The libSQL client's Cloudflare Workers ("workerd") export condition
  // points at a file that Next's output tracer otherwise misses, which
  // breaks the OpenNext Cloudflare bundle. Force it into the traced output.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/@libsql/isomorphic-ws/**"],
  },
};

module.exports = nextConfig;

// Local-dev-only shim so `npm run dev` can read Cloudflare bindings the
// same way the deployed Worker does (see src/lib/db.ts). It has no
// business running during a real build, on Vercel (or any other
// production build, including `opennextjs-cloudflare build` itself) this
// isn't a dev server and the call fails outright, breaking the build.
if (process.env.NODE_ENV === "development") {
  import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
}
