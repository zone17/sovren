import { sanitizeObject, isSensitiveKey } from '../sensitive-fields';

describe('sanitizeObject', () => {
  it('should redact sensitive fields', () => {
    const data = { name: 'Alice', password: 's3cret', email: 'a@b.com' };
    const result = sanitizeObject(data);
    expect(result.name).toBe('Alice');
    expect(result.password).toBe('[REDACTED]');
    expect(result.email).toBe('[REDACTED]');
  });

  it('should handle shared (non-circular) object references without data loss', () => {
    const shared = { x: 1, y: 2 };
    const data = { a: shared, b: shared } as Record<string, unknown>;
    const result = sanitizeObject(data);

    // Both fields should contain the sanitized data
    expect(result.a).toEqual({ x: 1, y: 2 });
    expect(result.b).toEqual({ x: 1, y: 2 });
    // Both should reference the same object (cached copy)
    expect(result.a).toBe(result.b);
  });

  it('should handle shared references with sensitive keys', () => {
    const shared = { token: 'abc123', value: 42 };
    const data = { first: shared, second: shared } as Record<string, unknown>;
    const result = sanitizeObject(data);

    expect((result.first as any).token).toBe('[REDACTED]');
    expect((result.first as any).value).toBe(42);
    expect((result.second as any).token).toBe('[REDACTED]');
    expect((result.second as any).value).toBe(42);
  });

  it('should handle circular references without infinite recursion', () => {
    const data: any = { name: 'circular' };
    data.self = data;
    const result = sanitizeObject(data);

    expect(result.name).toBe('circular');
    // The self-reference should point to the same sanitized object
    expect(result.self).toBe(result);
  });

  it('should handle deeply nested circular references', () => {
    const a: any = { name: 'a' };
    const b: any = { name: 'b', parent: a };
    a.child = b;
    const result = sanitizeObject(a);

    expect(result.name).toBe('a');
    expect((result.child as any).name).toBe('b');
    expect((result.child as any).parent).toBe(result);
  });

  it('should respect MAX_SANITIZE_DEPTH', () => {
    // Build a deeply nested object
    let obj: any = { value: 'deep' };
    for (let i = 0; i < 15; i++) {
      obj = { nested: obj };
    }

    const result = sanitizeObject(obj);
    // Walk down to find the truncation point
    let current: any = result;
    let depth = 0;
    while (current.nested && !current._truncated) {
      current = current.nested;
      depth++;
    }
    expect(current._truncated).toBe('[MAX_DEPTH]');
    expect(depth).toBe(10); // MAX_SANITIZE_DEPTH
  });

  it('should handle arrays with objects', () => {
    const data = {
      items: [
        { name: 'item1', secret: 'hidden' },
        { name: 'item2', apiKey: 'hidden2' },
      ],
    };
    const result = sanitizeObject(data);
    const items = result.items as any[];
    expect(items[0].name).toBe('item1');
    expect(items[0].secret).toBe('[REDACTED]');
    expect(items[1].name).toBe('item2');
    expect(items[1].apiKey).toBe('[REDACTED]');
  });

  it('should handle arrays with primitive values', () => {
    const data = { tags: ['a', 'b', 'c'], count: 3 };
    const result = sanitizeObject(data);
    expect(result.tags).toEqual(['a', 'b', 'c']);
    expect(result.count).toBe(3);
  });

  it('should handle null and undefined values', () => {
    const data = { a: null, b: undefined, c: 'value' };
    const result = sanitizeObject(data);
    expect(result.a).toBeNull();
    expect(result.b).toBeUndefined();
    expect(result.c).toBe('value');
  });

  it('should handle empty objects', () => {
    const result = sanitizeObject({});
    expect(result).toEqual({});
  });
});

describe('isSensitiveKey', () => {
  it('should identify sensitive keys', () => {
    expect(isSensitiveKey('password')).toBe(true);
    expect(isSensitiveKey('token')).toBe(true);
    expect(isSensitiveKey('apiKey')).toBe(true);
    expect(isSensitiveKey('api_key')).toBe(true);
    expect(isSensitiveKey('Authorization')).toBe(true);
    expect(isSensitiveKey('nsec')).toBe(true);
  });

  it('should not flag non-sensitive keys', () => {
    expect(isSensitiveKey('name')).toBe(false);
    expect(isSensitiveKey('email')).toBe(true);
    expect(isSensitiveKey('amount')).toBe(false);
  });
});
