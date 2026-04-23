/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@encorecare/shared", "@encorecare/database"],
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
