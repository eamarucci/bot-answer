import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@botanswer/database', '@botanswer/crypto'],
};

export default nextConfig;
