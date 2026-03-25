/**
 * Postinstall fix: Ensure Express 4.x uses path-to-regexp 0.1.x
 *
 * npm workspace hoisting can cause Express to resolve to a newer
 * path-to-regexp (v6+/v8+) from other packages like @vercel/node or msw.
 * Express 4.x requires path-to-regexp 0.1.x (uses the default export as a function).
 * Newer versions export { pathToRegexp } which breaks Express routing.
 */
import { existsSync, readFileSync, mkdirSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const expressPtrDir = join(
  __dirname,
  '..',
  'node_modules',
  'express',
  'node_modules',
  'path-to-regexp'
);
const backendPtrDir = join(
  __dirname,
  '..',
  'packages',
  'backend',
  'node_modules',
  'path-to-regexp'
);
const hoistedPtrDir = join(__dirname, '..', 'node_modules', 'path-to-regexp');

function getVersion(dir) {
  try {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    return pkg.version;
  } catch {
    return null;
  }
}

function run() {
  // Check if Express already has the right version nested
  const expressVersion = getVersion(expressPtrDir);
  if (expressVersion && expressVersion.startsWith('0.1.')) {
    return;
  }

  // Check if the hoisted version is already correct
  const hoistedVersion = getVersion(hoistedPtrDir);
  if (hoistedVersion && hoistedVersion.startsWith('0.1.')) {
    return;
  }

  // Copy from backend's local path-to-regexp if available
  const backendVersion = getVersion(backendPtrDir);
  if (backendVersion && backendVersion.startsWith('0.1.')) {
    try {
      mkdirSync(dirname(expressPtrDir), { recursive: true });
      cpSync(backendPtrDir, expressPtrDir, { recursive: true });
      console.log(`Fixed Express path-to-regexp: copied v${backendVersion} from backend`);
      return;
    } catch (err) {
      console.warn('Warning: Could not fix Express path-to-regexp:', err.message);
    }
  }

  console.warn(
    'Warning: Express may have an incompatible path-to-regexp version. ' +
      'If routing fails, run: npm install path-to-regexp@0.1.12 --save --workspace=packages/backend'
  );
}

run();
