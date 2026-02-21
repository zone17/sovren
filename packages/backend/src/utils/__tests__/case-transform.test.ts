import { snakeToCamel, camelToSnake } from '../case-transform';

describe('case-transform', () => {
  describe('snakeToCamel', () => {
    it('transforms flat snake_case keys to camelCase', () => {
      expect(snakeToCamel({ creator_id: 'abc', total_sats: 100 })).toEqual({
        creatorId: 'abc',
        totalSats: 100,
      });
    });

    it('transforms nested objects', () => {
      expect(
        snakeToCamel({
          line_items: { unit_price_sats: 500, item_count: 2 },
        })
      ).toEqual({
        lineItems: { unitPriceSats: 500, itemCount: 2 },
      });
    });

    it('transforms arrays of objects', () => {
      expect(
        snakeToCamel([
          { creator_id: 'a', amount_sats: 10 },
          { creator_id: 'b', amount_sats: 20 },
        ])
      ).toEqual([
        { creatorId: 'a', amountSats: 10 },
        { creatorId: 'b', amountSats: 20 },
      ]);
    });

    it('transforms nested arrays', () => {
      expect(
        snakeToCamel({
          line_items: [{ unit_price_sats: 100 }, { unit_price_sats: 200 }],
        })
      ).toEqual({
        lineItems: [{ unitPriceSats: 100 }, { unitPriceSats: 200 }],
      });
    });

    it('preserves null values', () => {
      expect(snakeToCamel({ due_date: null, paid_at: null })).toEqual({
        dueDate: null,
        paidAt: null,
      });
    });

    it('preserves Date objects without transforming', () => {
      const date = new Date('2026-01-01');
      expect(snakeToCamel({ created_at: date })).toEqual({ createdAt: date });
    });

    it('returns primitives unchanged', () => {
      expect(snakeToCamel('hello')).toBe('hello');
      expect(snakeToCamel(42)).toBe(42);
      expect(snakeToCamel(null)).toBe(null);
      expect(snakeToCamel(undefined)).toBe(undefined);
      expect(snakeToCamel(true)).toBe(true);
    });

    it('handles empty objects and arrays', () => {
      expect(snakeToCamel({})).toEqual({});
      expect(snakeToCamel([])).toEqual([]);
    });

    it('handles keys already in camelCase', () => {
      expect(snakeToCamel({ id: '1', name: 'test' })).toEqual({
        id: '1',
        name: 'test',
      });
    });

    it('handles deeply nested structures', () => {
      expect(
        snakeToCamel({
          order_details: {
            buyer_info: {
              nostr_pubkey: 'npub1...',
              display_name: 'Alice',
            },
            escrow_data: {
              payment_hash: 'abc',
              funded_at: '2026-01-01',
            },
          },
        })
      ).toEqual({
        orderDetails: {
          buyerInfo: {
            nostrPubkey: 'npub1...',
            displayName: 'Alice',
          },
          escrowData: {
            paymentHash: 'abc',
            fundedAt: '2026-01-01',
          },
        },
      });
    });
  });

  describe('camelToSnake', () => {
    it('transforms flat camelCase keys to snake_case', () => {
      expect(camelToSnake({ creatorId: 'abc', totalSats: 100 })).toEqual({
        creator_id: 'abc',
        total_sats: 100,
      });
    });

    it('transforms nested objects', () => {
      expect(
        camelToSnake({
          lineItems: { unitPriceSats: 500, itemCount: 2 },
        })
      ).toEqual({
        line_items: { unit_price_sats: 500, item_count: 2 },
      });
    });

    it('transforms arrays of objects', () => {
      expect(
        camelToSnake([
          { creatorId: 'a', amountSats: 10 },
          { creatorId: 'b', amountSats: 20 },
        ])
      ).toEqual([
        { creator_id: 'a', amount_sats: 10 },
        { creator_id: 'b', amount_sats: 20 },
      ]);
    });

    it('preserves null and primitives', () => {
      expect(camelToSnake(null)).toBe(null);
      expect(camelToSnake('hello')).toBe('hello');
      expect(camelToSnake(42)).toBe(42);
    });

    it('handles keys already in snake_case', () => {
      expect(camelToSnake({ id: '1', name: 'test' })).toEqual({
        id: '1',
        name: 'test',
      });
    });
  });

  describe('round-trip', () => {
    it('camelToSnake → snakeToCamel returns original', () => {
      const original = {
        creatorId: 'abc',
        lineItems: [{ unitPriceSats: 100, description: 'Test' }],
        dueDate: null,
        totalSats: 100,
      };
      expect(snakeToCamel(camelToSnake(original))).toEqual(original);
    });

    it('snakeToCamel → camelToSnake returns original', () => {
      const original = {
        creator_id: 'abc',
        line_items: [{ unit_price_sats: 100, description: 'Test' }],
        due_date: null,
        total_sats: 100,
      };
      expect(camelToSnake(snakeToCamel(original))).toEqual(original);
    });
  });
});
