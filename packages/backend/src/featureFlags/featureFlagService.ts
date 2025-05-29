import fs from 'fs';
import path from 'path';
import { FeatureFlags, parseFeatureFlags } from '@sovren/shared/featureFlags';
import { SafeFileStorage } from './fileUtils';

const FLAGS_PATH = path.resolve(__dirname, 'flags.json');
const LOG_PATH = path.resolve(__dirname, 'flag-changes.log');

const fileStorage = new SafeFileStorage(FLAGS_PATH);

async function readFlagsFile(): Promise<FeatureFlags> {
  const raw = await fileStorage.read();
  return parseFeatureFlags(JSON.parse(raw));
}

async function writeFlagsFile(flags: FeatureFlags): Promise<void> {
  await fileStorage.write(JSON.stringify(flags, null, 2));
}

function logChange(user: string, oldFlags: FeatureFlags, newFlags: FeatureFlags): void {
  const timestamp = new Date().toISOString();
  const diff = (Object.keys(newFlags) as (keyof FeatureFlags)[])
    .filter((key) => oldFlags[key] !== newFlags[key])
    .map((key) => `${key}: ${oldFlags[key]} -> ${newFlags[key]}`);
  if (diff.length > 0) {
    const logEntry = `[${timestamp}] ${user} changed: ${diff.join(', ')}\n`;
    fs.appendFileSync(LOG_PATH, logEntry);
  }
}

export class FeatureFlagService {
  private flags: FeatureFlags;

  constructor() {
    this.flags = parseFeatureFlags({}); // Initialize with defaults
    this.initialize().catch(console.error);
  }

  private async initialize(): Promise<void> {
    try {
      this.flags = await readFlagsFile();
    } catch (error) {
      console.error('Failed to initialize feature flags:', error);
      // Keep using defaults if file read fails
    }
  }

  async getFlags(): Promise<FeatureFlags> {
    // Always read the latest from disk
    this.flags = await readFlagsFile();
    return this.flags;
  }

  async updateFlags(newFlags: Partial<FeatureFlags>, user: string): Promise<FeatureFlags> {
    const oldFlags = { ...this.flags };
    this.flags = { ...this.flags, ...parseFeatureFlags({ ...this.flags, ...newFlags }) };
    await writeFlagsFile(this.flags);
    logChange(user, oldFlags, this.flags);
    // Re-read from disk to ensure sync
    this.flags = await readFlagsFile();
    return this.flags;
  }

  async cleanupOldBackups(maxAgeDays: number = 7): Promise<void> {
    await fileStorage.cleanupOldBackups(maxAgeDays);
  }
}

export const featureFlagService = new FeatureFlagService();
