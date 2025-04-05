const siteUrl = "https://your-site.com"; // or however you define it

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // RSS rewrites
      {
        source: "/rss.xml",
        destination: `${siteUrl}/rss/tools.xml`,
      },
    ];
  },
};

export default nextConfig;
