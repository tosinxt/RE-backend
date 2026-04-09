import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

@Injectable()
export class JsonStoreService {
  private readonly baseDir = path.join(process.cwd(), 'data');

  private async ensureDir() {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  private filePath(key: string) {
    return path.join(this.baseDir, `${key}.json`);
  }

  async read<T>(key: string, fallback: T): Promise<T> {
    await this.ensureDir();
    const p = this.filePath(key);
    try {
      const raw = await fs.readFile(p, 'utf8');
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  async write<T>(key: string, value: T): Promise<void> {
    await this.ensureDir();
    const p = this.filePath(key);
    const tmp = `${p}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
    await fs.rename(tmp, p);
  }
}

