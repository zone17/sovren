declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
      user?: { nostr_pubkey: string; [key: string]: unknown };
    }
  }
}

export {};
