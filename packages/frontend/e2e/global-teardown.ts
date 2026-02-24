import type { FullConfig } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function globalTeardown(_config: FullConfig): Promise<void> {
  const authDir = path.join(__dirname, '../test-results/.auth');
  await fs.rm(authDir, { recursive: true, force: true });
}

export default globalTeardown;
