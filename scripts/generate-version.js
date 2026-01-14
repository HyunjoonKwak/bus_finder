const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const getGitHash = () => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'dev';
  }
};

const pkg = require('../package.json');
const hash = getGitHash();

const content = `// Auto-generated at build time
export const VERSION = '${pkg.version}';
export const GIT_HASH = '${hash}';
export const BUILD_TIME = '${new Date().toISOString()}';
`;

const outputPath = path.join(__dirname, '../lib/version.ts');
fs.writeFileSync(outputPath, content);

console.log(`Version file generated: v${pkg.version} (${hash})`);
