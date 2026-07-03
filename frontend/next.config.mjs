/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully static build for cPanel shared hosting — `next build` emits ./out
  output: 'export',
  // No image optimization server exists on static hosting
  images: { unoptimized: true },
  // /pcs -> out/pcs/index.html so Apache serves routes without rewrites
  trailingSlash: true,
};

export default nextConfig;
