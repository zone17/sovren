/**
 * P1-043b: Express Type Safety Tests
 *
 * Verifies that the Express Request augmentation uses a named AuthenticatedUser
 * interface with explicit properties instead of an open index signature.
 *
 * This is primarily a compile-time check -- the test confirms TypeScript
 * accepts valid usage of req.user with the AuthenticatedUser shape.
 */

describe('P1-043b: Express Type Augmentation', () => {
  describe('AuthenticatedUser interface', () => {
    it('should define AuthenticatedUser with nostr_pubkey as required property', () => {
      // Read the type definition file and verify it defines AuthenticatedUser
      const fs = require('fs');
      const path = require('path');
      const typePath = path.join(__dirname, '../../types/express.d.ts');
      const typeContent = fs.readFileSync(typePath, 'utf8');

      // Verify AuthenticatedUser interface exists
      expect(typeContent).toContain('interface AuthenticatedUser');

      // Verify nostr_pubkey is declared
      expect(typeContent).toContain('nostr_pubkey: string');
    });

    it('should NOT have an open index signature [key: string]: unknown', () => {
      const fs = require('fs');
      const path = require('path');
      const typePath = path.join(__dirname, '../../types/express.d.ts');
      const typeContent = fs.readFileSync(typePath, 'utf8');

      // The old dangerous pattern should be gone
      expect(typeContent).not.toContain('[key: string]: unknown');
    });

    it('should type req.user as AuthenticatedUser (not inline object)', () => {
      const fs = require('fs');
      const path = require('path');
      const typePath = path.join(__dirname, '../../types/express.d.ts');
      const typeContent = fs.readFileSync(typePath, 'utf8');

      // req.user should reference the named interface
      expect(typeContent).toContain('user?: AuthenticatedUser');
    });

    it('should allow accessing nostr_pubkey on req.user at type level', () => {
      // This test verifies that TypeScript compiles correctly with the type
      const mockReq = {} as Express.Request;

      // Assign a valid user object
      mockReq.user = {
        nostr_pubkey: 'abc123def456',
      };

      // Access the property
      const pubkey: string | undefined = mockReq.user?.nostr_pubkey;
      expect(pubkey).toBe('abc123def456');
    });

    it('should allow req.user to be undefined (optional property)', () => {
      const mockReq = {} as Express.Request;

      // user should be optional
      expect(mockReq.user).toBeUndefined();
    });

    it('should still declare rawBody on Request', () => {
      const fs = require('fs');
      const path = require('path');
      const typePath = path.join(__dirname, '../../types/express.d.ts');
      const typeContent = fs.readFileSync(typePath, 'utf8');

      expect(typeContent).toContain('rawBody?: Buffer');
    });
  });
});
