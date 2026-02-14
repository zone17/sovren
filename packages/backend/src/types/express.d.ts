declare global {
  namespace Express {
    interface AuthenticatedUser {
      nostr_pubkey: string;
      role?: 'creator' | 'supporter' | 'admin';
      id?: string;
      signature_verified?: boolean;
      iat?: number;
      exp?: number;
    }

    interface Request {
      rawBody?: Buffer;
      user?: AuthenticatedUser;
      nostr?: {
        pubkey: string;
        npub?: string;
        sessionId?: string;
        role?: 'creator' | 'supporter' | 'admin';
        session?: any;
      };
    }
  }
}

export {};
