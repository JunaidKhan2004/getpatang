import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Readable } from 'node:stream';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Object storage. Development uses the local disk; production plugs in S3/R2
 * by implementing the same methods (Phase 10). Files are never stored in the database.
 */
export interface StoredFile {
  key: string;
  /** Public URL, or null for private files that are streamed through an authorised endpoint. */
  url: string | null;
}

export const PUBLIC_UPLOADS_ROUTE = '/uploads';

@Injectable()
export class StorageService {
  readonly root: string;
  private readonly publicBaseUrl: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>('UPLOAD_DIR') ?? 'uploads');
    this.publicBaseUrl = (config.get<string>('PUBLIC_API_ORIGIN') ?? `http://localhost:${config.get('PORT') ?? 4000}`).replace(/\/$/, '');
  }

  get publicDir() {
    return join(this.root, 'public');
  }

  async put(buffer: Buffer, extension: string, opts: { isPrivate: boolean; folder: string }): Promise<StoredFile> {
    const name = `${Date.now().toString(36)}-${randomBytes(12).toString('hex')}.${extension}`;
    const key = `${opts.isPrivate ? 'private' : 'public'}/${opts.folder}/${name}`;
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer, { flag: 'wx' });
    return { key, url: opts.isPrivate ? null : `${this.publicBaseUrl}${PUBLIC_UPLOADS_ROUTE}/${key.slice('public/'.length)}` };
  }

  read(key: string): Readable {
    return createReadStream(this.pathFor(key));
  }

  async remove(key: string): Promise<void> {
    await unlink(this.pathFor(key)).catch(() => undefined);
  }

  /** Resolves a key inside the storage root; rejects anything that would escape it. */
  private pathFor(key: string): string {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root)) throw new Error('Invalid storage key');
    return path;
  }
}
