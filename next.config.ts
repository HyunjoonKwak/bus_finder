import type { NextConfig } from "next";
import { execSync } from 'child_process';

const getGitHash = () => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
};

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_GIT_HASH: getGitHash(),
  },
};

export default nextConfig;
