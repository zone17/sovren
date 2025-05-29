import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);

export class FileLock {
  private lockFile: string;
  private lockTimeout: number;

  constructor(filePath: string, timeoutMs: number = 5000) {
    this.lockFile = `${filePath}.lock`;
    this.lockTimeout = timeoutMs;
  }

  async acquire(): Promise<void> {
    const startTime = Date.now();
    while (fs.existsSync(this.lockFile)) {
      if (Date.now() - startTime > this.lockTimeout) {
        throw new Error('Failed to acquire file lock: timeout');
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await writeFile(this.lockFile, process.pid.toString());
  }

  async release(): Promise<void> {
    if (fs.existsSync(this.lockFile)) {
      await fs.promises.unlink(this.lockFile);
    }
  }
}

export class SafeFileStorage {
  private filePath: string;
  private backupDir: string;
  private lock: FileLock;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.backupDir = path.join(path.dirname(filePath), 'backups');
    this.lock = new FileLock(filePath);
  }

  private async ensureBackupDir(): Promise<void> {
    if (!fs.existsSync(this.backupDir)) {
      await mkdir(this.backupDir, { recursive: true });
    }
  }

  private async createBackup(): Promise<void> {
    await this.ensureBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `flags-${timestamp}.json`);
    await fs.promises.copyFile(this.filePath, backupPath);
  }

  async read(): Promise<string> {
    await this.lock.acquire();
    try {
      return await readFile(this.filePath, 'utf-8');
    } finally {
      await this.lock.release();
    }
  }

  async write(content: string): Promise<void> {
    await this.lock.acquire();
    try {
      await this.createBackup();
      await writeFile(this.filePath, content);
    } finally {
      await this.lock.release();
    }
  }

  async cleanupOldBackups(maxAgeDays: number = 7): Promise<void> {
    await this.ensureBackupDir();
    const files = await fs.promises.readdir(this.backupDir);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(this.backupDir, file);
      const stats = await fs.promises.stat(filePath);
      const ageDays = (now - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

      if (ageDays > maxAgeDays) {
        await fs.promises.unlink(filePath);
      }
    }
  }
}
