/**
 * StorageService — Abstracts file storage behind Supabase Storage.
 *
 * Replaces local fs.writeFile calls that break in multi-replica deployments.
 * Falls back to local filesystem in development when Supabase Storage is unavailable.
 *
 * Production Readiness: INFRA-002
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import logger from '../../lib/logger';

const BUCKET_MEDIA = 'media';
const BUCKET_RECEIPTS = 'receipts';

let supabaseClient: SupabaseClient | null = null;

function getStorageClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;
  const url = process.env.SUPABASE_URL;
  // Uses service role key — bypasses RLS. Only use for admin/background operations.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

export interface UploadResult {
  url: string;
  storagePath: string;
}

/**
 * Upload a file buffer to Supabase Storage.
 * Falls back to local filesystem if Supabase is unavailable (dev mode).
 */
export async function uploadFile(
  bucket: string,
  filePath: string,
  buffer: Buffer,
  contentType?: string
): Promise<UploadResult> {
  const client = getStorageClient();

  if (client) {
    const { error } = await client.storage.from(bucket).upload(filePath, buffer, {
      cacheControl: '3600',
      upsert: true,
      contentType,
    });

    if (error) {
      logger.error('Supabase Storage upload failed, falling back to local', {
        bucket,
        filePath,
        error: error.message,
      });
      return localFallback(bucket, filePath, buffer);
    }

    const {
      data: { publicUrl },
    } = client.storage.from(bucket).getPublicUrl(filePath);

    return { url: publicUrl, storagePath: filePath };
  }

  // Local fallback for development
  return localFallback(bucket, filePath, buffer);
}

async function localFallback(
  bucket: string,
  filePath: string,
  buffer: Buffer
): Promise<UploadResult> {
  const localPath = path.join(process.cwd(), 'public', bucket, filePath);
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  await fs.writeFile(localPath, buffer);
  logger.warn('File saved to local filesystem (dev only — not suitable for production)', {
    path: localPath,
  });
  return { url: `/${bucket}/${filePath}`, storagePath: filePath };
}

/**
 * Upload a media file (images, videos, etc.)
 */
export async function uploadMedia(
  filePath: string,
  buffer: Buffer,
  contentType?: string
): Promise<UploadResult> {
  return uploadFile(BUCKET_MEDIA, filePath, buffer, contentType);
}

/**
 * Upload a receipt PDF
 */
export async function uploadReceipt(
  fileName: string,
  buffer: Buffer
): Promise<UploadResult> {
  return uploadFile(BUCKET_RECEIPTS, fileName, buffer, 'application/pdf');
}

/**
 * Get a public URL for an existing file
 */
export function getPublicUrl(bucket: string, filePath: string): string | null {
  const client = getStorageClient();
  if (!client) return null;
  const {
    data: { publicUrl },
  } = client.storage.from(bucket).getPublicUrl(filePath);
  return publicUrl;
}
