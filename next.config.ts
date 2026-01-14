import type { NextConfig } from "next";
import { execSync } from 'child_process';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const getGitHash = (): string => {
  try {
    const hash = execSync('git rev-parse --short HEAD', {
      cwd: __dirname,
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
