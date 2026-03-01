declare module 'nostr-tools/pure' {
  export function finalizeEvent(event: any, secretKey: any): any;
  export function generateSecretKey(): Uint8Array;
  export function getPublicKey(secretKey: Uint8Array): string;
  export function verifyEvent(event: any): boolean;
  export function getEventHash(event: any): string;
}

declare module 'nostr-tools/pool' {
  export class SimplePool {
    querySync(relays: string[], filter: any): any[];
    get(relays: string[], filter: any, opts?: any): Promise<any>;
    list(relays: string[], filters: any[], opts?: any): Promise<any[]>;
    publish(relays: string[], event: any): Promise<any>[];
    close(relays: string[]): void;
  }
}
