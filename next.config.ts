import type { NextConfig } from "next";
import { execSync } from 'child_process';

const getGitHash = (): string => {
  try {
    const hash = execSync('git rev-parse --short HEAD', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    return hash || 'dev';
  } catch {
    return 'dev';
  }
};

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_GIT_HASH: getGitHash(),
  },
};

export default nextConfig;
