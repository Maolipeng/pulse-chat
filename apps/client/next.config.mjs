const allowedDevOrigins = process.env.NEXT_ALLOWED_DEV_ORIGINS
  ? process.env.NEXT_ALLOWED_DEV_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : [];

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
  reactCompiler: true,
  allowedDevOrigins,
};

export default nextConfig;
