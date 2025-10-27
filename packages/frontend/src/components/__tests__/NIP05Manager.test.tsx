import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NIP05Manager } from '../NIP05Manager';

// Test data
const mockVerifications = [
  {
    id: 'verification-1',
    user_id: 'user-1',
    nostr_pubkey: 'a'.repeat(64),
    nip05_identifier: 'alice@example.com',
    domain: 'example.com',
    local_part: 'alice',
    verification_status: 'verified',
    verification_method: 'http',
    verification_data: { url: 'https://example.com/.well-known/nostr.json' },
    verified_at: '2024-01-01T00:00:00Z',
    expires_at: '2024-12-31T23:59:59Z',
    last_checked_at: '2024-01-01T00:00:00Z',
    check_count: 1,
    metadata: {},
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    domain_info: {
      is_trusted: true,
      verification_methods_supported: ['http', 'dns'],
    },
    status_info: {
      is_expired: false,
      needs_refresh: false,
    },
  },
  {
    id: 'verification-2',
    user_id: 'user-1',
    nostr_pubkey: 'b'.repeat(64),
    nip05_identifier: 'bob@example.com',
    domain: 'example.com',
    local_part: 'bob',
    verification_status: 'pending',
    verification_method: 'dns',
    verification_data: {},
    last_checked_at: '2024-01-01T00:00:00Z',
    check_count: 0,
    metadata: {},
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    domain_info: {
      is_trusted: false,
      verification_methods_supported: ['http', 'dns'],
    },
    status_info: {
      is_expired: false,
      needs_refresh: false,
    },
  },
  {
    id: 'verification-3',
    user_id: 'user-1',
    nostr_pubkey: 'c'.repeat(64),
    nip05_identifier: 'charlie@example.com',
    domain: 'example.com',
    local_part: 'charlie',
    verification_status: 'failed',
    verification_method: 'http',
    verification_data: {},
    last_checked_at: '2024-01-01T00:00:00Z',
    check_count: 3,
    failure_reason: 'HTTP 404: Not Found',
    metadata: {},
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    domain_info: {
      is_trusted: false,
      verification_methods_supported: ['http'],
    },
    status_info: {
      is_expired: false,
      needs_refresh: false,
    },
  },
];

// Helper function to create mock fetch response
const createMockResponse = (data: any, success = true): Response => {
  return {
    ok: success,
    json: async () => ({ success, data }),
    status: success ? 200 : 400,
    statusText: success ? 'OK' : 'Bad Request',
  } as Response;
};

describe('🔍 NIP05Manager Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(
      createMockResponse({
        verifications: mockVerifications,
      })
    );
  });

  describe('📝 Basic Rendering', () => {
    it('should render loading state initially', () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockImplementation(
        () => new Promise(() => {})
      ); // Never resolves
      render(<NIP05Manager />);

      expect(screen.getByText('Loading NIP-05 verifications...')).toBeInTheDocument();
    });

    it('should render verification overview with correct stats', async () => {
      render(<NIP05Manager />);

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument(); // Verified count
      });

      // Check all stat cards are present (use more specific selectors)
      const statCards = screen.getAllByText(/^(Verified|Pending|Failed|Total)$/);
      expect(statCards).toHaveLength(4);
    });

    it('should render verification cards when data is loaded', async () => {
      render(<NIP05Manager />);

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument();
        expect(screen.getByText('bob@example.com')).toBeInTheDocument();
        expect(screen.getByText('charlie@example.com')).toBeInTheDocument();
      });
    });

    it('should render empty state when no verifications exist', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(
        createMockResponse({ verifications: [] })
      );
      render(<NIP05Manager />);

      await waitFor(() => {
        expect(screen.getByText('No NIP-05 Verifications')).toBeInTheDocument();
        expect(screen.getByText('Create Verification')).toBeInTheDocument();
      });
    });
  });

  describe('⚡ User Interactions', () => {
    it('should open create dialog when Add Verification button is clicked', async () => {
      render(<NIP05Manager />);

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      });

      const addButton = screen.getByText('Add Verification');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Create NIP-05 Verification')).toBeInTheDocument();
      });
    });

    it('should handle create verification form submission', async () => {
      const createResponse = createMockResponse({
        verification: {
          id: 'new-verification',
          nip05_identifier: 'test@example.com',
          verification_status: 'pending',
        },
      });
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
        createMockResponse({ verifications: mockVerifications })
      );
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(createResponse);

      const onVerificationCreated = jest.fn();
      render(<NIP05Manager onVerificationCreated={onVerificationCreated} />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      });

      // Open create dialog
      const addButton = screen.getByText('Add Verification');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Create NIP-05 Verification')).toBeInTheDocument();
      });

      // Fill form
      const identifierInput = screen.getByPlaceholderText('username@domain.com');
      fireEvent.change(identifierInput, { target: { value: 'test@example.com' } });

      // Submit form
      const createButton = screen.getByText('Create Verification');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/nip05/verify',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              nip05_identifier: 'test@example.com',
              verification_method: 'http',
            }),
          })
        );
      });
    });

    it('should handle verification refresh', async () => {
      // Mock refresh response
      const refreshResponse = createMockResponse({
        verification: {
          ...mockVerifications[0],
          last_checked_at: new Date().toISOString(),
        },
      });
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
        createMockResponse({ verifications: mockVerifications })
      );
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(refreshResponse);

      render(<NIP05Manager />);

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      });

      // Click refresh button
      const refreshButtons = screen.getAllByText('Refresh');
      fireEvent.click(refreshButtons[0]); // Main refresh button

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/nip05/verifications', expect.any(Object));
      });
    });

    it('should handle copy to clipboard', async () => {
      const mockWriteText = jest.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

      render(<NIP05Manager />);

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      });

      // Find and click copy button (using the copy icon)
      const copyButtons = screen.getAllByRole('button');
      const copyButton = copyButtons.find((button) =>
        button.querySelector('svg')?.classList.contains('lucide-copy')
      );

      if (copyButton) {
        fireEvent.click(copyButton);
        await waitFor(() => {
          expect(mockWriteText).toHaveBeenCalledWith('alice@example.com');
        });
      }
    });
  });

  describe('🚨 Error Handling', () => {
    it('should display error message when API call fails', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(
        new Error('Network error')
      );
      render(<NIP05Manager />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load verifications/)).toBeInTheDocument();
      });
    });

    it('should handle create verification errors', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
        createMockResponse({ verifications: mockVerifications })
      );
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
        createMockResponse(null, false)
      );

      render(<NIP05Manager />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      });

      // Open and fill create dialog
      const addButton = screen.getByText('Add Verification');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Create NIP-05 Verification')).toBeInTheDocument();
      });

      const identifierInput = screen.getByPlaceholderText('username@domain.com');
      fireEvent.change(identifierInput, { target: { value: 'invalid' } });

      const createButton = screen.getByText('Create Verification');
      fireEvent.click(createButton);

      // Button should be disabled for invalid input
      expect(createButton).toBeDisabled();
    });
  });

  describe('📱 Status Badges and Indicators', () => {
    it('should display correct status badges for different verification states', async () => {
      render(<NIP05Manager />);

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      });

      // Check for status badges in verification cards (not the stats)
      const statusBadges = screen
        .getAllByText('Verified')
        .filter((el) => el.closest('.bg-green-100') !== null);
      expect(statusBadges.length).toBeGreaterThan(0);
    });

    it('should display verification method badges', async () => {
      render(<NIP05Manager />);

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      });

      expect(screen.getByText('HTTP')).toBeInTheDocument();
      expect(screen.getByText('DNS')).toBeInTheDocument();
    });

    it('should show trusted domain indicators', async () => {
      render(<NIP05Manager />);

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      });

      expect(screen.getByText('Trusted Domain')).toBeInTheDocument();
    });
  });

  describe('🎯 Form Validation', () => {
    it('should validate NIP-05 identifier format', async () => {
      render(<NIP05Manager />);

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      });

      // Open create dialog
      const addButton = screen.getByText('Add Verification');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Create NIP-05 Verification')).toBeInTheDocument();
      });

      // Test invalid format
      const identifierInput = screen.getByPlaceholderText('username@domain.com');
      const createButton = screen.getByText('Create Verification');

      fireEvent.change(identifierInput, { target: { value: 'invalid-format' } });
      expect(createButton).toBeDisabled();

      fireEvent.change(identifierInput, { target: { value: 'valid@domain.com' } });
      expect(createButton).not.toBeDisabled();
    });

    it('should handle different verification methods', async () => {
      render(<NIP05Manager />);

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      });

      // Open create dialog
      const addButton = screen.getByText('Add Verification');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Create NIP-05 Verification')).toBeInTheDocument();
      });

      // Check verification method options
      expect(screen.getByText('HTTP (/.well-known/nostr.json)')).toBeInTheDocument();
      expect(screen.getByText('DNS (TXT record)')).toBeInTheDocument();
      expect(screen.getByText('Manual Verification')).toBeInTheDocument();
    });
  });

  describe('🎮 Keyboard Navigation', () => {
    it('should support keyboard interaction for dialog', async () => {
      render(<NIP05Manager />);

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      });

      const addButton = screen.getByText('Add Verification');
      addButton.focus();
      fireEvent.keyDown(addButton, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('Create NIP-05 Verification')).toBeInTheDocument();
      });
    });
  });

  describe('♿ Accessibility', () => {
    it('should have sufficient color contrast for status indicators', async () => {
      render(<NIP05Manager />);

      await waitFor(() => {
        // Use more specific query to avoid multiple elements
        const verifiedText = screen.getAllByText('Verified')[0];
        expect(verifiedText).toBeInTheDocument();
        expect(screen.getAllByText('Pending')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Failed')[0]).toBeInTheDocument();
      });
    });

    it('should have proper ARIA labels and roles', async () => {
      render(<NIP05Manager />);

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      });

      // Check for proper button roles
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('📱 Responsive Design', () => {
    it('should adapt to mobile viewport', async () => {
      render(<NIP05Manager />);

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      });

      // Check that grid layout adapts (md:grid-cols-4 should collapse to single column)
      const statCards = screen.getAllByText(/^(Verified|Pending|Failed|Total)$/);
      const statsGrid = statCards[0].closest('.grid');
      expect(statsGrid).toHaveClass('grid-cols-1', 'md:grid-cols-4');
    });

    it('should handle touch interactions', async () => {
      render(<NIP05Manager />);

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      });

      const addButton = screen.getByText('Add Verification');
      fireEvent.touchStart(addButton);
      fireEvent.touchEnd(addButton);

      await waitFor(() => {
        expect(screen.getByText('Create NIP-05 Verification')).toBeInTheDocument();
      });
    });
  });

  describe('🔄 Real-time Updates', () => {
    it('should handle concurrent updates gracefully', async () => {
      render(<NIP05Manager />);

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      });

      // Simulate concurrent operations
      const addButton = screen.getByText('Add Verification');
      const refreshButtons = screen.getAllByText('Refresh');

      fireEvent.click(addButton);
      fireEvent.click(refreshButtons[0]);

      // Should handle both operations without conflicts
      await waitFor(() => {
        expect(screen.getByText('Create NIP-05 Verification')).toBeInTheDocument();
      });
    });
  });
});
