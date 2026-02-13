declare global {
  namespace Express {
    interface AuthenticatedUser {
      nostr_pubkey: string;
      role?: string;
      id?: string;
      signature_verified?: boolean;
      iat?: number;
      exp?: number;
    }

    interface Request {
      rawBody?: Buffer;
      user?: AuthenticatedUser;
    }
  }
}

export {};
