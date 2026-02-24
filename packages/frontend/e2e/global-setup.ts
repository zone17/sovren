import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { FullConfig } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function globalSetup(_config: FullConfig): Promise<void> {
  const authDir = path.join(__dirname, '../test-results/.auth');
  await fs.mkdir(authDir, { recursive: true });
}

export default globalSetup;
