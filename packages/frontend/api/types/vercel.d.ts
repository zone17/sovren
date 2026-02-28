import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Local type declarations for Vercel serverless functions.
 * Replaces @vercel/node to eliminate transitive vulnerability chain
 * (minimatch ReDoS, path-to-regexp backtracking via @vercel/build-utils).
 */

export interface VercelRequest extends IncomingMessage {
  query: Record<string, string | string[]>;
  cookies: Record<string, string>;
  body: unknown;
}

export interface VercelResponse extends ServerResponse {
  send: (body: unknown) => VercelResponse;
  json: (obj: unknown) => VercelResponse;
  status: (statusCode: number) => VercelResponse;
  redirect: (statusOrUrl: string | number, url?: string) => VercelResponse;
}
