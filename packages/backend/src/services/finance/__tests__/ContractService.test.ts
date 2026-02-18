/**
 * ContractService Tests
 * EPIC-011: Business Manager — Contract templates and red flag analysis
 *
 * Coverage targets:
 *   - getTemplates: with/without category, empty result, DB error
 *   - getTemplate: found, not found (null data), DB error
 *   - createContract: with/without templateId, null insert, DB error, draft status
 *   - getContracts: success, empty, DB error
 *   - updateContract: owner-only enforcement, signed_at on signed transition,
 *                     no signed_at for other transitions, partial update, DB error
 *   - analyzeRedFlags: all 4 flag types, all patterns, case-insensitive,
 *                      boundary conditions, multi-flag, one-per-type dedup, empty text
 */

import { ContractService } from '../ContractService';

// ---------------------------------------------------------------------------
// Mock factory helpers
// ---------------------------------------------------------------------------

/**
 * Build a chainable Supabase query mock.
 * The terminal methods (order, single) resolve with `resolvedValue`.
 * Every filter method returns `this` so chains compose correctly.
 */
function makeChain(resolvedValue: { data: any; error: any }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue(resolvedValue),
    single: jest.fn().mockResolvedValue(resolvedValue),
  };
  return chain;
}

function makeLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ContractService', () => {
  let mockDb: any;
  let mockLogger: ReturnType<typeof makeLogger>;
  let service: ContractService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = makeLogger();
    mockDb = { from: jest.fn() };
  });

  // =========================================================================
  // getTemplates
  // =========================================================================

  describe('getTemplates', () => {
    it('returns all templates ordered by created_at desc when no category given', async () => {
      const templates = [
        { id: 'tpl-1', name: 'NDA', category: 'legal' },
        { id: 'tpl-2', name: 'Sponsorship', category: 'sponsorship' },
      ];
      const chain = makeChain({ data: templates, error: null });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      const result = await service.getTemplates();

      expect(mockDb.from).toHaveBeenCalledWith('contract_templates');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.eq).not.toHaveBeenCalled();
      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toEqual(templates);
    });

    it('applies category filter via eq() when category is provided', async () => {
      const chain = makeChain({ data: [{ id: 'tpl-1', category: 'legal' }], error: null });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      const result = await service.getTemplates('legal');

      expect(chain.eq).toHaveBeenCalledWith('category', 'legal');
      expect(result).toHaveLength(1);
    });

    it('returns empty array when data is null', async () => {
      const chain = makeChain({ data: null, error: null });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      const result = await service.getTemplates();

      expect(result).toEqual([]);
    });

    it('returns empty array when data is an empty array', async () => {
      const chain = makeChain({ data: [], error: null });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      const result = await service.getTemplates();

      expect(result).toEqual([]);
    });

    it('throws the database error when query fails', async () => {
      const dbError = { message: 'Connection refused', code: '08000' };
      const chain = makeChain({ data: null, error: dbError });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      await expect(service.getTemplates()).rejects.toEqual(dbError);
    });

    it('logs the call with the category parameter', async () => {
      const chain = makeChain({ data: [], error: null });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      await service.getTemplates('sponsorship');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'ContractService.getTemplates',
        expect.objectContaining({ category: 'sponsorship' })
      );
    });
  });

  // =========================================================================
  // getTemplate
  // =========================================================================

  describe('getTemplate', () => {
    it('returns the template for a valid id', async () => {
      const template = { id: 'tpl-1', name: 'NDA', category: 'legal' };
      const chain = makeChain({ data: template, error: null });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      const result = await service.getTemplate('tpl-1');

      expect(chain.eq).toHaveBeenCalledWith('id', 'tpl-1');
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(template);
    });

    it('throws "Template not found" when data is null and error is null', async () => {
      const chain = makeChain({ data: null, error: null });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      await expect(service.getTemplate('missing')).rejects.toThrow(
        'Template not found: missing'
      );
    });

    it('throws the database error when query fails', async () => {
      const dbError = { message: 'Permission denied' };
      const chain = makeChain({ data: null, error: dbError });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      await expect(service.getTemplate('tpl-x')).rejects.toEqual(dbError);
    });
  });

  // =========================================================================
  // createContract
  // =========================================================================

  describe('createContract', () => {
    it('inserts a contract with status=draft and returns the new id', async () => {
      const chain = makeChain({ data: { id: 'contract-1' }, error: null });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      const result = await service.createContract('creator-1', {
        counterparty: 'Acme Corp',
        filledText: 'Contract text here',
      });

      expect(result).toEqual({ id: 'contract-1' });
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          creator_id: 'creator-1',
          counterparty: 'Acme Corp',
          filled_text: 'Contract text here',
          status: 'draft',
        })
      );
    });

    it('does not include template_id when templateId is not provided', async () => {
      const chain = makeChain({ data: { id: 'c-1' }, error: null });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      await service.createContract('creator-1', {
        counterparty: 'Acme',
        filledText: 'text',
      });

      const insertArg = chain.insert.mock.calls[0][0];
      expect(insertArg).not.toHaveProperty('template_id');
    });

    it('includes template_id in the row when templateId is provided', async () => {
      const chain = makeChain({ data: { id: 'c-2' }, error: null });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      await service.createContract('creator-1', {
        templateId: 'tpl-1',
        counterparty: 'Brand Inc',
        filledText: 'Filled contract',
      });

      const insertArg = chain.insert.mock.calls[0][0];
      expect(insertArg).toHaveProperty('template_id', 'tpl-1');
    });

    it('throws "Failed to create contract" when insert returns null data', async () => {
      const chain = makeChain({ data: null, error: null });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      await expect(
        service.createContract('creator-1', { counterparty: 'X', filledText: 'y' })
      ).rejects.toThrow('Failed to create contract');
    });

    it('throws the database error when insert fails', async () => {
      const dbError = { message: 'Unique violation', code: '23505' };
      const chain = makeChain({ data: null, error: dbError });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      await expect(
        service.createContract('creator-1', { counterparty: 'X', filledText: 'y' })
      ).rejects.toEqual(dbError);
    });

    it('uses the contracts table for insertion', async () => {
      const chain = makeChain({ data: { id: 'c-3' }, error: null });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      await service.createContract('creator-1', { counterparty: 'Y', filledText: 'z' });

      expect(mockDb.from).toHaveBeenCalledWith('contracts');
    });
  });

  // =========================================================================
  // getContracts
  // =========================================================================

  describe('getContracts', () => {
    it('returns contracts with joined template data for the given creatorId', async () => {
      const contracts = [
        { id: 'c-1', creator_id: 'creator-1', contract_templates: { name: 'NDA', category: 'legal' } },
      ];
      const chain = makeChain({ data: contracts, error: null });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      const result = await service.getContracts('creator-1');

      expect(chain.select).toHaveBeenCalledWith('*, contract_templates(name, category)');
      expect(chain.eq).toHaveBeenCalledWith('creator_id', 'creator-1');
      expect(result).toEqual(contracts);
    });

    it('returns empty array when creator has no contracts (null data)', async () => {
      const chain = makeChain({ data: null, error: null });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      const result = await service.getContracts('creator-empty');

      expect(result).toEqual([]);
    });

    it('returns empty array when data is an empty array', async () => {
      const chain = makeChain({ data: [], error: null });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      expect(await service.getContracts('creator-1')).toEqual([]);
    });

    it('throws when database returns an error', async () => {
      const dbError = { message: 'Permission denied' };
      const chain = makeChain({ data: null, error: dbError });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      await expect(service.getContracts('creator-1')).rejects.toEqual(dbError);
    });
  });

  // =========================================================================
  // updateContract — owner-only enforcement
  // =========================================================================

  describe('updateContract', () => {
    /**
     * The update chain ends with .eq().eq() — the last eq call resolves the promise.
     * We need a chain where the final eq resolves rather than returns `this`.
     */
    function makeUpdateChain(resolvedValue: { data: any; error: any }) {
      let callCount = 0;
      const chain: any = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockImplementation(() => {
          callCount++;
          // second eq call terminates the chain (creator_id filter)
          if (callCount >= 2) return Promise.resolve(resolvedValue);
          return chain;
        }),
      };
      return chain;
    }

    it('enforces owner-only by filtering on both contractId and creatorId', async () => {
      const chain = makeUpdateChain({ data: null, error: null });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      await service.updateContract('contract-1', 'creator-1', { status: 'sent' });

      expect(chain.eq).toHaveBeenCalledWith('id', 'contract-1');
      expect(chain.eq).toHaveBeenCalledWith('creator_id', 'creator-1');
    });

    it('includes updated_at in the update payload', async () => {
      const chain = makeUpdateChain({ data: null, error: null });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      await service.updateContract('contract-1', 'creator-1', { filledText: 'new' });

      const updateArg = chain.update.mock.calls[0][0];
      expect(updateArg).toHaveProperty('updated_at');
      expect(typeof updateArg.updated_at).toBe('string');
    });

    it('sets signed_at when status transitions to "signed"', async () => {
      const chain = makeUpdateChain({ data: null, error: null });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      await service.updateContract('contract-1', 'creator-1', { status: 'signed' });

      const updateArg = chain.update.mock.calls[0][0];
      expect(updateArg).toHaveProperty('signed_at');
      expect(typeof updateArg.signed_at).toBe('string');
    });

    it('does NOT set signed_at for non-signed status transitions', async () => {
      const chain = makeUpdateChain({ data: null, error: null });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      await service.updateContract('contract-1', 'creator-1', { status: 'cancelled' });

      const updateArg = chain.update.mock.calls[0][0];
      expect(updateArg).not.toHaveProperty('signed_at');
    });

    it('omits filled_text from payload when filledText is not provided', async () => {
      const chain = makeUpdateChain({ data: null, error: null });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      await service.updateContract('contract-1', 'creator-1', { status: 'sent' });

      const updateArg = chain.update.mock.calls[0][0];
      expect(updateArg).not.toHaveProperty('filled_text');
    });

    it('includes filled_text in payload when filledText is provided', async () => {
      const chain = makeUpdateChain({ data: null, error: null });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      await service.updateContract('contract-1', 'creator-1', { filledText: 'Updated text' });

      const updateArg = chain.update.mock.calls[0][0];
      expect(updateArg).toHaveProperty('filled_text', 'Updated text');
    });

    it('throws when database returns an error', async () => {
      const dbError = { message: 'Update blocked by RLS' };
      const chain = makeUpdateChain({ data: null, error: dbError });
      mockDb.from.mockReturnValue(chain);
      service = new ContractService(mockDb, mockLogger);

      await expect(
        service.updateContract('contract-1', 'creator-1', { status: 'sent' })
      ).rejects.toEqual(dbError);
    });
  });

  // =========================================================================
  // analyzeRedFlags — pure logic, no DB interaction
  // =========================================================================

  describe('analyzeRedFlags', () => {
    beforeEach(() => {
      // analyzeRedFlags is pure computation — no DB calls needed
      service = new ContractService(mockDb, mockLogger);
    });

    // --- Clean contract ---

    it('returns empty array for a clean contract with no red flags', async () => {
      // Note: "Non-exclusive" still triggers /exclusive/i, so we use text that
      // avoids every pattern keyword entirely.
      const text =
        'Creator will deliver 3 videos per month. Payment due within 30 days. ' +
        'A limited license for 1 year with renewal option is granted to the client.';
      expect(await service.analyzeRedFlags(text)).toEqual([]);
    });

    it('handles an empty string without throwing', async () => {
      expect(await service.analyzeRedFlags('')).toEqual([]);
    });

    // --- Exclusivity ---

    it('detects exclusivity via "exclusive" keyword', async () => {
      const flags = await service.analyzeRedFlags('The creator grants exclusive rights to the brand.');
      const f = flags.find((x) => x.type === 'exclusivity');
      expect(f).toBeDefined();
      expect(f!.severity).toBe('critical');
      expect(f!.suggestion).toMatch(/exclusivity window/i);
      expect(f!.match.toLowerCase()).toContain('exclusive');
    });

    it('detects exclusivity via "sole right" phrase', async () => {
      const flags = await service.analyzeRedFlags('Client holds sole right to distribute content.');
      expect(flags.some((f) => f.type === 'exclusivity')).toBe(true);
    });

    it('detects exclusivity via "non-compete" phrase', async () => {
      const flags = await service.analyzeRedFlags('Creator must abide by a non-compete clause for 12 months.');
      expect(flags.some((f) => f.type === 'exclusivity')).toBe(true);
    });

    // --- Perpetual ---

    it('detects perpetual via "perpetuity" keyword', async () => {
      const flags = await service.analyzeRedFlags('License granted in perpetuity across all territories.');
      const f = flags.find((x) => x.type === 'perpetual');
      expect(f).toBeDefined();
      expect(f!.severity).toBe('critical');
      expect(f!.suggestion).toMatch(/fixed term/i);
    });

    it('detects perpetual via "perpetual" keyword', async () => {
      const flags = await service.analyzeRedFlags('A perpetual, irrevocable license is hereby granted.');
      expect(flags.some((f) => f.type === 'perpetual')).toBe(true);
    });

    it('detects perpetual via "irrevocable" keyword', async () => {
      const flags = await service.analyzeRedFlags('Grant is irrevocable and worldwide.');
      expect(flags.some((f) => f.type === 'perpetual')).toBe(true);
    });

    it('detects perpetual via "in perpetuity" exact phrase', async () => {
      const flags = await service.analyzeRedFlags('Rights are licensed in perpetuity to the client.');
      expect(flags.some((f) => f.type === 'perpetual')).toBe(true);
    });

    // --- Delayed payment ---

    it('detects delayed_payment for "net 90" (>60 days)', async () => {
      const flags = await service.analyzeRedFlags('Invoices payable Net 90 days after receipt.');
      const f = flags.find((x) => x.type === 'delayed_payment');
      expect(f).toBeDefined();
      expect(f!.severity).toBe('warning');
      expect(f!.suggestion).toMatch(/Net-30|Net-45/);
    });

    it('detects delayed_payment for "within 90 days" phrasing', async () => {
      const flags = await service.analyzeRedFlags('Must pay within 90 days of delivery.');
      expect(flags.some((f) => f.type === 'delayed_payment')).toBe(true);
    });

    it('detects delayed_payment for "net 61" (boundary: just above 60)', async () => {
      const flags = await service.analyzeRedFlags('Payment terms: net 61 days.');
      expect(flags.some((f) => f.type === 'delayed_payment')).toBe(true);
    });

    it('detects delayed_payment for three-digit day counts (net 120)', async () => {
      const flags = await service.analyzeRedFlags('Invoices payable net 120 days.');
      expect(flags.some((f) => f.type === 'delayed_payment')).toBe(true);
    });

    it('does NOT flag "net 30" as delayed payment', async () => {
      const flags = await service.analyzeRedFlags('Payment due net 30 days after invoice.');
      expect(flags.some((f) => f.type === 'delayed_payment')).toBe(false);
    });

    it('does NOT flag "net 60" as delayed payment (boundary: threshold is >60)', async () => {
      const flags = await service.analyzeRedFlags('Standard payment terms: Net 60.');
      expect(flags.some((f) => f.type === 'delayed_payment')).toBe(false);
    });

    it('does NOT flag "within 30 days" as delayed payment', async () => {
      const flags = await service.analyzeRedFlags('Please pay within 30 days of invoice.');
      expect(flags.some((f) => f.type === 'delayed_payment')).toBe(false);
    });

    // --- IP assignment ---

    it('detects ip_assignment via "assign.*intellectual property" pattern', async () => {
      const flags = await service.analyzeRedFlags(
        'Creator agrees to assign all intellectual property rights to the company.'
      );
      const f = flags.find((x) => x.type === 'ip_assignment');
      expect(f).toBeDefined();
      expect(f!.severity).toBe('critical');
      expect(f!.suggestion).toMatch(/license grant/i);
    });

    it('detects ip_assignment via "transfer copyright" pattern', async () => {
      const flags = await service.analyzeRedFlags(
        'All works shall transfer copyright to the client upon delivery.'
      );
      expect(flags.some((f) => f.type === 'ip_assignment')).toBe(true);
    });

    it('detects ip_assignment via "work for hire" phrase', async () => {
      const flags = await service.analyzeRedFlags(
        'This engagement is constituted as work for hire under 17 U.S.C.'
      );
      expect(flags.some((f) => f.type === 'ip_assignment')).toBe(true);
    });

    // --- Multi-flag and deduplication ---

    it('detects all four flag types in a single egregious contract', async () => {
      const text =
        'This exclusive, perpetual, irrevocable license in perpetuity assigns all intellectual property ' +
        'to the client. Payment due net 90 days. Creator accepts work-for-hire status.';
      const flags = await service.analyzeRedFlags(text);
      const types = flags.map((f) => f.type);
      expect(types).toContain('exclusivity');
      expect(types).toContain('perpetual');
      expect(types).toContain('delayed_payment');
      expect(types).toContain('ip_assignment');
    });

    it('returns only one finding per flag type even if multiple patterns match', async () => {
      // "perpetuity" and "perpetual" both match the perpetual patterns
      const text = 'Rights are granted in perpetuity and are perpetual and irrevocable forever.';
      const flags = await service.analyzeRedFlags(text);
      const perpetualFlags = flags.filter((f) => f.type === 'perpetual');
      expect(perpetualFlags).toHaveLength(1);
    });

    it('is case-insensitive for all flag patterns', async () => {
      const text = 'EXCLUSIVE RIGHTS GRANTED IN PERPETUITY. WORK FOR HIRE. NET 90.';
      const flags = await service.analyzeRedFlags(text);
      const types = flags.map((f) => f.type);
      expect(types).toContain('exclusivity');
      expect(types).toContain('perpetual');
      expect(types).toContain('ip_assignment');
      expect(types).toContain('delayed_payment');
    });

    // --- Shape validation ---

    it('each returned flag has all required fields with correct shapes', async () => {
      const text =
        'Exclusive, irrevocable license. Creator must assign intellectual property. Net 90. Work for hire.';
      const flags = await service.analyzeRedFlags(text);

      expect(flags.length).toBeGreaterThan(0);
      for (const flag of flags) {
        expect(typeof flag.type).toBe('string');
        expect(typeof flag.match).toBe('string');
        expect(flag.severity).toMatch(/^(warning|critical)$/);
        expect(typeof flag.suggestion).toBe('string');
        expect(flag.suggestion.length).toBeGreaterThan(0);
      }
    });

    it('logs the text length when called', async () => {
      const text = 'A simple contract.';
      await service.analyzeRedFlags(text);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'ContractService.analyzeRedFlags',
        expect.objectContaining({ textLength: text.length })
      );
    });
  });
});
