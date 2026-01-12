/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
  reactCompiler: true,
  allowedDevOrigins: [
    "http://192.168.31.177",
    "https://chat-home.peakol.top",
    "https://chat-self-server.peakol.top",
  ],
};

export default nextConfig;
