# Profile Management Feature

**Story**: US-310 - Build Profile Management UI Component
**Status**: Implemented
**Date**: 2025-10-26

## Overview

Comprehensive NOSTR profile viewing and editing component implementing NIP-01 metadata events (kind 0). Provides full profile management capabilities with support for all standard NOSTR profile fields.

## Architecture

### Component Hierarchy

```
ProfileManager (Main Component)
├── ProfileDisplay (View Mode)
│   ├── Banner Image
│   ├── Avatar
│   ├── Profile Info
│   ├── NIP-05 Verification Badge
│   ├── Lightning Tip Button
│   └── Action Buttons
└── ProfileEdit (Edit Mode)
    ├── Form Fields
    ├── Image Upload
    ├── Preview Mode
    └── Form Actions
```

### Mermaid Diagrams

**Component Interaction**:
![Component Interaction](https://github.com/fp/Sovren/blob/main/monitoring/dashboard/docs/architecture/diagrams/profile-management/component-interaction.mmd)

**Data Flow**:
![Data Flow](https://github.com/fp/Sovren/blob/main/monitoring/dashboard/docs/architecture/diagrams/profile-management/data-flow.mmd)

**State Management**:
![State Management](https://github.com/fp/Sovren/blob/main/monitoring/dashboard/docs/architecture/diagrams/profile-management/state-management.mmd)

**Process Flow**:
![Process Flow](https://github.com/fp/Sovren/blob/main/monitoring/dashboard/docs/architecture/diagrams/profile-management/process-flow.mmd)

## Features

### View Mode

- **Profile Display**: Shows all profile metadata fields
- **NIP-05 Verification**: Visual badge for verified identifiers
- **Avatar & Banner**: Image display with fallbacks
- **Stats**: Follower/following counts
- **Lightning Tips**: Button for sending tips (if Lightning address configured)
- **Social Actions**: Follow, share, block, mute, report

### Edit Mode

- **Inline Editing**: All profile fields editable
- **Real-time Validation**: URL, NIP-05, Lightning address validation
- **Image Upload**: Support for avatar and banner images
- **Preview Mode**: See changes before publishing
- **Auto-save**: Publishes as kind 0 NOSTR event

### Profile Fields (NIP-01)

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `name` | string | Username | Max 30 chars |
| `display_name` | string | Display name | Max 50 chars |
| `about` | string | Bio/description | Max 500 chars |
| `picture` | string | Avatar URL | Valid URL |
| `banner` | string | Banner URL | Valid URL |
| `nip05` | string | NIP-05 identifier | user@domain.com |
| `website` | string | Personal website | Valid URL |
| `lud16` | string | Lightning address | user@domain.com |

## Usage

### Basic Usage

```typescript
import { ProfileManager } from '@/features/nostr/profile';

function MyComponent() {
  return (
    <ProfileManager
      pubkey="npub1234..."
      isOwnProfile={false}
      showEditButton={true}
      showActionButtons={true}
    />
  );
}
```

### With Callbacks

```typescript
import { ProfileManager } from '@/features/nostr/profile';
import type { NostrProfile, ProfileAction } from '@/features/nostr/profile';

function MyComponent() {
  const handleProfileUpdated = (profile: NostrProfile) => {
    console.log('Profile updated:', profile);
  };

  const handleAction = (action: ProfileAction, pubkey: string) => {
    switch (action) {
      case 'follow':
        // Handle follow
        break;
      case 'tip':
        // Show Lightning invoice
        break;
      case 'share':
        // Share profile link
        break;
    }
  };

  return (
    <ProfileManager
      pubkey="npub1234..."
      isOwnProfile={true}
      onProfileUpdated={handleProfileUpdated}
      onAction={handleAction}
    />
  );
}
```

### Custom Hook Usage

```typescript
import { useProfileManager } from '@/features/nostr/profile';

function CustomProfileComponent({ pubkey }: { pubkey: string }) {
  const {
    profile,
    isLoading,
    error,
    isEditMode,
    formData,
    formErrors,
    enterEditMode,
    updateFormField,
    saveProfile,
  } = useProfileManager(pubkey);

  // Custom implementation using the hook
}
```

## Props

### ProfileManagerProps

```typescript
interface ProfileManagerProps {
  pubkey: string;                    // Public key (hex or npub)
  isOwnProfile?: boolean;            // Whether this is current user's profile
  onProfileUpdated?: (profile: NostrProfile) => void;
  onAction?: (action: ProfileAction, pubkey: string) => void;
  showEditButton?: boolean;          // Show edit button (default: true)
  showActionButtons?: boolean;       // Show action buttons (default: true)
  className?: string;                // Custom CSS class
}
```

## Integration Points

### Services Used

- **EventPublisherService** (US-303): Publishes kind 0 events
- **SubscriptionManagerService** (US-304): Fetches profile events
- **NIP05Service** (US-306): Verifies NIP-05 identifiers
- **EventCacheService** (US-312): Caches profile data
- **KeyManagementService** (US-315): Signs events

### Event Format

Profile metadata is published as a kind 0 event:

```json
{
  "kind": 0,
  "pubkey": "user_public_key_hex",
  "created_at": 1234567890,
  "tags": [],
  "content": "{\"name\":\"Alice\",\"about\":\"Bitcoin enthusiast\",\"picture\":\"https://example.com/avatar.jpg\",\"nip05\":\"alice@example.com\",\"lud16\":\"alice@getalby.com\"}"
}
```

## Accessibility

- **WCAG AA Compliant**: All components meet accessibility standards
- **Keyboard Navigation**: Full keyboard support for all interactions
- **Screen Reader Support**: Proper ARIA labels and semantic HTML
- **Focus Management**: Visible focus indicators
- **Form Labels**: All inputs have associated labels
- **Error Announcements**: Validation errors announced to screen readers

## Responsive Design

- **Mobile-First**: Optimized for mobile devices (320px+)
- **Breakpoints**:
  - Mobile: 320px - 640px
  - Tablet: 641px - 1024px
  - Desktop: 1025px+
- **Touch-Optimized**: Large tap targets (44px minimum)
- **Adaptive Layout**: Stacks vertically on mobile, horizontal on desktop

## Performance

- **Code Splitting**: Component lazy-loaded
- **Image Optimization**: Lazy loading with fallbacks
- **Caching**: Profile data cached in EventCacheService
- **Debounced Validation**: Form validation debounced to reduce re-renders
- **Memoization**: React.memo used for sub-components

## Testing

### Test Coverage

- **Component Tests**: 85%+ coverage
- **Hook Tests**: 95%+ coverage
- **Integration Tests**: All user flows covered

### Test Files

- `__tests__/ProfileManager.test.tsx` - Component tests
- `__tests__/useProfileManager.test.ts` - Hook tests

### Running Tests

```bash
# Run all profile tests
npm test -- ProfileManager

# Run with coverage
npm test -- ProfileManager --coverage

# Watch mode
npm test -- ProfileManager --watch
```

## Future Enhancements

1. **Image Cropping**: Built-in image editor for avatars
2. **QR Code**: Generate profile QR codes
3. **NIP-19 Links**: Generate nprofile links with relay hints
4. **Profile Templates**: Pre-designed profile templates
5. **Export/Import**: Export profile data as JSON
6. **Verification**: Additional verification methods beyond NIP-05
7. **Custom Fields**: Support for custom metadata fields

## Related Stories

- US-308: NOSTR Type Definitions
- US-315: Key Management Service
- US-306: NIP-05 Verification Service
- US-303: Event Publisher Service
- US-304: Subscription Manager Service
- US-312: Event Cache Service

## References

- [NIP-01: Basic Protocol Flow](https://github.com/nostr-protocol/nips/blob/master/01.md)
- [NIP-05: Mapping Nostr keys to DNS-based internet identifiers](https://github.com/nostr-protocol/nips/blob/master/05.md)
- [NIP-19: bech32-encoded entities](https://github.com/nostr-protocol/nips/blob/master/19.md)
