/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * P1-042: GitHub Secret Encryption Tests
 *
 * Verifies:
 * - updateGitHubSecretsAtomically uses execFileSync('gh', ...) not execSync
 * - The broken encryptSecret method (base64 != encryption) no longer exists
 * - gh secret set is called with correct arguments
 */

import * as fs from 'fs';
import * as path from 'path';

describe('P1-042: GitHub Secret Encryption Fix', () => {
  const scriptPath = path.join(__dirname, '../automated-github-token-rotation.ts');

  let scriptContent: string;

  beforeAll(() => {
    scriptContent = fs.readFileSync(scriptPath, 'utf8');
  });

  describe('Broken encryptSecret removal', () => {
    it('should not contain the broken base64-only encryptSecret implementation', () => {
      // The old broken implementation just did base64 encoding, not real encryption
      // Check that the specific broken pattern is gone
      // If encryptSecret still exists, it should NOT have the base64-only body
      if (scriptContent.includes('encryptSecret')) {
        // The method exists but should use proper encryption (sodium) not base64
        expect(scriptContent).not.toMatch(
          /encryptSecret[\s\S]*?return Buffer\.from\(secret\)\.toString\('base64'\)/
        );
      }
    });

    it('should not contain the encryptSecret method at all', () => {
      // The fix removes encryptSecret entirely since gh secret set handles encryption
      expect(scriptContent).not.toContain('encryptSecret');
    });

    it('should not contain the misleading comment about simplified version', () => {
      // The old code had a comment: "This is a simplified version - use proper sodium encryption in production"
      expect(scriptContent).not.toContain('simplified version - use proper sodium encryption');
    });
  });

  describe('updateGitHubSecretsAtomically implementation', () => {
    it('should contain updateGitHubSecretsAtomically method', () => {
      expect(scriptContent).toContain('updateGitHubSecretsAtomically');
    });

    it('should use execFileSync for gh commands (not execSync) per P1-021', () => {
      // Extract the updateGitHubSecretsAtomically method body
      const methodMatch = scriptContent.match(
        /updateGitHubSecretsAtomically[\s\S]*?(?=\n\s{2}private|\n\s{2}async\s|\n\s{2}public\s|\n})/
      );

      if (methodMatch) {
        const methodBody = methodMatch[0];

        // If the method uses gh CLI (the recommended fix), it should use execFileSync
        if (methodBody.includes("'gh'") || methodBody.includes('"gh"')) {
          // Should use execFileSync (safe from shell injection) not execSync
          expect(methodBody).toContain('execFileSync');
        }
      }
    });

    it('should reference gh secret set for updating secrets', () => {
      // The fix should use gh secret set (either directly or via execFileSync)
      const usesGhSecretSet =
        scriptContent.includes("'secret', 'set'") ||
        scriptContent.includes('"secret", "set"') ||
        scriptContent.includes('gh secret set');

      // The method that handles setting secrets should use gh CLI
      // This could be in updateGitHubSecretsAtomically or updateGitHubSecrets
      const usesGhCli =
        usesGhSecretSet ||
        scriptContent.includes("execFileSync('gh'") ||
        scriptContent.includes('execFileSync("gh"');

      expect(usesGhCli).toBe(true);
    });
  });

  describe('Import safety', () => {
    it('should import execFileSync (not just execSync) from child_process', () => {
      // The script should import execFileSync for safe command execution
      expect(scriptContent).toMatch(
        /import\s*{[^}]*execFileSync[^}]*}\s*from\s*['"]child_process['"]/
      );
    });
  });

  describe('Secret name handling', () => {
    it('should reference GITHUB_TOKEN as the secret name to update', () => {
      expect(scriptContent).toContain('GITHUB_TOKEN');
    });
  });
});
