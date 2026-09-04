/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      // وحّدنا التدقيق على /audits؛ أي رابط قديم لـ /internal-audit يُعاد توجيهه.
      { source: "/internal-audit", destination: "/audits", permanent: true },
    ]
  },
}

export default nextConfig
