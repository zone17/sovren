/**
 * FilterBuilder Storybook Stories
 *
 * US-314: Build NOSTR Filter Builder UI Component
 * Epic 003: NOSTR Consolidation
 *
 * Comprehensive stories documenting all FilterBuilder variants and states
 */

import type { Meta, StoryObj } from '@storybook/react';
import { FilterBuilder } from './FilterBuilder';
import type { NostrFilter } from '@shared/types/nostr/index';
import { useState } from 'react';

// ========================================
// Meta Configuration
// ========================================

const meta: Meta<typeof FilterBuilder> = {
  title: 'Components/NOSTR/FilterBuilder',
  component: FilterBuilder,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
## NOSTR Filter Builder

A comprehensive UI component for building NOSTR subscription filters without writing code.

### Features

- **Visual Interface**: Build filters through an intuitive UI
- **Presets**: Quick access to common filter patterns (user notes, mentions, global feed, etc.)
- **Validation**: Real-time validation with error messages and suggestions
- **Templates**: Save and load custom filter configurations
- **Import/Export**: JSON import/export for sharing filters
- **Accessibility**: WCAG AA compliant with keyboard navigation

### Usage

\`\`\`tsx
import { FilterBuilder } from '@/components/nostr/FilterBuilder';

function MyComponent() {
  const [filter, setFilter] = useState<NostrFilter>({});

  return (
    <FilterBuilder
      onFilterChange={setFilter}
      currentPubkey="your-pubkey-hex"
    />
  );
}
\`\`\`

### Filter Fields

- **Event IDs**: Filter by specific event IDs (64-char hex)
- **Authors**: Filter by author pubkeys (hex or npub format)
- **Kinds**: Event types (text notes, metadata, DMs, etc.)
- **Tags**: Generic tag filtering (#e, #p, #t, etc.)
- **Time Range**: Since/until timestamps
- **Limit**: Maximum events to fetch (1-5000)
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onFilterChange: {
      description: 'Callback function when filter changes',
      action: 'filter changed',
    },
    currentPubkey: {
      description: 'Current user pubkey (enables user-specific presets)',
      control: 'text',
    },
    initialFilter: {
      description: 'Initial filter to load',
      control: 'object',
    },
    showAdvanced: {
      description: 'Show advanced fields by default',
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof FilterBuilder>;

// ========================================
// Stories
// ========================================

/**
 * Default empty state
 */
export const Default: Story = {
  args: {},
};

/**
 * With current user pubkey (enables user-specific presets)
 */
export const WithCurrentUser: Story = {
  args: {
    currentPubkey: 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234',
  },
  parameters: {
    docs: {
      description: {
        story:
          'When a pubkey is provided, user-specific presets (User Notes, Mentions) are enabled.',
      },
    },
  },
};

/**
 * With initial filter (global feed)
 */
export const WithInitialFilter: Story = {
  args: {
    initialFilter: {
      kinds: [1],
      limit: 50,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Component can be initialized with an existing filter.',
      },
    },
  },
};

/**
 * User notes preset applied
 */
export const UserNotesPreset: Story = {
  args: {
    currentPubkey: 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234',
    initialFilter: {
      authors: ['abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234'],
      kinds: [1],
      limit: 50,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Filter configured to show text notes from a specific user.',
      },
    },
  },
};

/**
 * Mentions preset applied
 */
export const MentionsPreset: Story = {
  args: {
    currentPubkey: 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234',
    initialFilter: {
      kinds: [1],
      '#p': ['abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234'],
      limit: 50,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Filter configured to show posts mentioning the user.',
      },
    },
  },
};

/**
 * Global feed preset applied
 */
export const GlobalFeedPreset: Story = {
  args: {
    initialFilter: {
      kinds: [1],
      limit: 50,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Filter configured to show recent text notes from all users.',
      },
    },
  },
};

/**
 * Long-form content filter
 */
export const LongFormContent: Story = {
  args: {
    initialFilter: {
      kinds: [30023],
      limit: 20,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Filter configured to show articles and long-form content.',
      },
    },
  },
};

/**
 * Complex filter with multiple constraints
 */
export const ComplexFilter: Story = {
  args: {
    initialFilter: {
      authors: [
        'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234',
        'efgh5678901234efgh5678901234efgh5678901234efgh5678901234efgh5678',
      ],
      kinds: [1, 6, 7],
      '#t': ['bitcoin', 'nostr', 'lightning'],
      since: Math.floor(Date.now() / 1000) - 86400, // Last 24 hours
      limit: 100,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Advanced filter with multiple authors, kinds, hashtags, and time range.',
      },
    },
  },
};

/**
 * Filter with event references
 */
export const WithEventReferences: Story = {
  args: {
    initialFilter: {
      kinds: [1],
      '#e': ['abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234'],
      limit: 100,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Filter configured to show replies to a specific event.',
      },
    },
  },
};

/**
 * Filter with pubkey references
 */
export const WithPubkeyReferences: Story = {
  args: {
    initialFilter: {
      kinds: [1],
      '#p': [
        'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234',
        'efgh5678901234efgh5678901234efgh5678901234efgh5678901234efgh5678',
      ],
      limit: 50,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Filter configured to show events mentioning specific users.',
      },
    },
  },
};

/**
 * Filter with hashtags
 */
export const WithHashtags: Story = {
  args: {
    initialFilter: {
      kinds: [1],
      '#t': ['bitcoin', 'lightning', 'nostr', 'decentralization'],
      limit: 100,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Filter configured to show events with specific hashtags.',
      },
    },
  },
};

/**
 * Filter with time range
 */
export const WithTimeRange: Story = {
  args: {
    initialFilter: {
      kinds: [1],
      since: Math.floor(Date.now() / 1000) - 604800, // Last week
      until: Math.floor(Date.now() / 1000),
      limit: 100,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Filter configured with a specific time range (last week).',
      },
    },
  },
};

/**
 * Filter with large limit
 */
export const WithLargeLimit: Story = {
  args: {
    initialFilter: {
      kinds: [1],
      limit: 5000, // Maximum allowed
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Filter with maximum limit (5000 events). May trigger performance warnings.',
      },
    },
  },
};

/**
 * Multiple event kinds selected
 */
export const MultipleKinds: Story = {
  args: {
    initialFilter: {
      kinds: [0, 1, 3, 4, 7], // Metadata, text, contacts, DM, reactions
      limit: 100,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Filter configured to show multiple event types.',
      },
    },
  },
};

/**
 * Empty filter (shows warnings)
 */
export const EmptyFilter: Story = {
  args: {
    initialFilter: {},
  },
  parameters: {
    docs: {
      description: {
        story:
          'Empty filter with no constraints. Will show validation warnings about potentially expensive queries.',
      },
    },
  },
};

/**
 * Interactive example with state management
 */
export const Interactive: Story = {
  render: () => {
    const [filter, setFilter] = useState<NostrFilter>({});
    const [appliedFilter, setAppliedFilter] = useState<NostrFilter | null>(null);

    return (
      <div className="space-y-4">
        <FilterBuilder
          onFilterChange={setFilter}
          currentPubkey="abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234"
        />

        {filter && Object.keys(filter).length > 0 && (
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">Current Filter State:</h3>
            <pre className="text-xs overflow-x-auto">{JSON.stringify(filter, null, 2)}</pre>
          </div>
        )}
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive example showing real-time filter updates.',
      },
    },
  },
};

/**
 * Mobile viewport
 */
export const Mobile: Story = {
  args: {
    currentPubkey: 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234',
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story: 'Component in mobile viewport (375px width).',
      },
    },
  },
};

/**
 * Tablet viewport
 */
export const Tablet: Story = {
  args: {
    currentPubkey: 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234',
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
    docs: {
      description: {
        story: 'Component in tablet viewport (768px width).',
      },
    },
  },
};

/**
 * Desktop viewport
 */
export const Desktop: Story = {
  args: {
    currentPubkey: 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234',
  },
  parameters: {
    viewport: {
      defaultViewport: 'desktop',
    },
    docs: {
      description: {
        story: 'Component in desktop viewport (1920px width).',
      },
    },
  },
};

/**
 * Dark mode
 */
export const DarkMode: Story = {
  args: {
    currentPubkey: 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234',
    initialFilter: {
      kinds: [1],
      limit: 50,
    },
  },
  parameters: {
    backgrounds: {
      default: 'dark',
    },
    docs: {
      description: {
        story: 'Component in dark mode.',
      },
    },
  },
};

/**
 * With validation errors
 */
export const WithValidationErrors: Story = {
  args: {
    initialFilter: {
      kinds: [1],
      since: Math.floor(Date.now() / 1000), // Now
      until: Math.floor(Date.now() / 1000) - 86400, // Yesterday (invalid range)
      limit: 10000, // Exceeds maximum (invalid)
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Component displaying validation errors (invalid time range and limit).',
      },
    },
  },
};

/**
 * Loading state with presets disabled
 */
export const PresetsDisabled: Story = {
  args: {
    // No currentPubkey provided
  },
  parameters: {
    docs: {
      description: {
        story: 'When no pubkey is provided, user-specific presets are disabled.',
      },
    },
  },
};

/**
 * With custom styling
 */
export const CustomStyling: Story = {
  args: {
    className: 'max-w-4xl mx-auto',
    currentPubkey: 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234',
  },
  parameters: {
    docs: {
      description: {
        story: 'Component with custom CSS classes applied.',
      },
    },
  },
};
