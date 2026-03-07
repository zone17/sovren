# Subscription Management Feature

**Story**: PAY-005 - Build Subscription Management UI Components
**Status**: ✅ Complete
**Coverage**: 95%+ (SubscriptionCard), 85%+ (Overall Feature)

## Overview

The Subscription Management feature provides comprehensive tools for both creators and supporters to manage Lightning Network-powered subscriptions on the Sovren platform.

## Architecture

### Component Hierarchy

```
features/subscriptions/
├── components/
│   ├── SubscriptionManager.tsx       (Creator view)
│   ├── UserSubscriptionManager.tsx   (User/Supporter view)
│   ├── SubscriptionCard.tsx          (Reusable card component)
│   └── __tests__/
│       ├── SubscriptionCard.test.tsx
│       └── UserSubscriptionManager.test.tsx
├── services/
│   └── useUserSubscriptionService.ts (API integration hook)
├── types/
│   ├── index.ts
│   └── userSubscription.ts
└── index.ts (Barrel export)
```

### Mermaid Diagrams

**Component Architecture**:
![Component Architecture](https://github.com/sovren/sovren/blob/main/docs/architecture/diagrams/subscriptions/component-architecture.mmd)
[View Source](../architecture/diagrams/subscriptions/component-architecture.mmd) | [Edit in Mermaid Live](https://mermaid.live/)

**Data Flow**:
![Data Flow](https://github.com/sovren/sovren/blob/main/docs/architecture/diagrams/subscriptions/data-flow.mmd)
[View Source](../architecture/diagrams/subscriptions/data-flow.mmd) | [Edit in Mermaid Live](https://mermaid.live/)

**Subscription Lifecycle**:
![Subscription Lifecycle](https://github.com/sovren/sovren/blob/main/docs/architecture/diagrams/subscriptions/subscription-lifecycle.mmd)
[View Source](../architecture/diagrams/subscriptions/subscription-lifecycle.mmd) | [Edit in Mermaid Live](https://mermaid.live/)

**User Actions**:
![User Actions](https://github.com/sovren/sovren/blob/main/docs/architecture/diagrams/subscriptions/user-actions.mmd)
[View Source](../architecture/diagrams/subscriptions/user-actions.mmd) | [Edit in Mermaid Live](https://mermaid.live/)

## Components

### SubscriptionCard

Reusable card component for displaying subscription information.

**Props**:

```typescript
interface SubscriptionCardProps {
  subscription: Subscription; // Subscription data
  variant?: 'user' | 'creator'; // Display mode
  actions?: {
    // Optional action handlers
    onView?: (subscription: Subscription) => void;
    onEdit?: (subscription: Subscription) => void;
    onPause?: (subscription: Subscription) => void;
    onResume?: (subscription: Subscription) => void;
    onCancel?: (subscription: Subscription) => void;
    onDelete?: (subscription: Subscription) => void;
  };
  showStats?: boolean; // Show subscriber count (creator only)
  className?: string; // Custom CSS classes
  disabled?: boolean; // Disable all actions
}
```

**Usage Example**:

```tsx
import { SubscriptionCard } from '@/features/subscriptions';

const MyComponent = () => {
  const handleView = (subscription) => {
    console.log('Viewing:', subscription);
  };

  return (
    <SubscriptionCard
      subscription={subscriptionData}
      variant="user"
      actions={{
        onView: handleView,
        onPause: handlePause,
        onCancel: handleCancel,
      }}
    />
  );
};
```

**Features**:

- 📱 **Responsive Design**: Mobile-first, adapts to all screen sizes
- ♿ **Accessible**: WCAG 2.1 AA compliant, keyboard navigable
- 🎨 **Status Badges**: Visual indicators for active, paused, cancelled, expired, pending
- ⚡ **Lightning Integration**: Displays satoshi amounts with USD conversion
- 📅 **Payment Countdown**: Shows days until next payment with warning colors
- 🎁 **Benefits Display**: Lists subscription benefits (truncates after 3)
- 📊 **Subscriber Stats**: Optional subscriber count (creator variant)

### SubscriptionManager

Creator-facing subscription tier and subscriber management.

**Features**:

- Create, edit, delete subscription tiers
- Set pricing in satoshis with multiple billing intervals (monthly, quarterly, yearly)
- Manage tier features and descriptions
- View subscriber list with status, payment history, and stats
- Pause/resume subscriber access
- Real-time revenue tracking

**Usage**:

```tsx
import { SubscriptionManager } from '@/features/subscriptions';

const CreatorDashboard = () => {
  return <SubscriptionManager />;
};
```

### UserSubscriptionManager

User/Supporter-facing subscription management dashboard.

**Features**:

- View all active subscriptions across creators
- Manage auto-renewal settings
- Add, edit, delete payment methods (Lightning, Bitcoin, NOSTR)
- View subscription history with export to CSV
- Pause, resume, or cancel subscriptions
- Track content access and value received

**Usage**:

```tsx
import { UserSubscriptionManager } from '@/features/subscriptions';

const UserDashboard = () => {
  return <UserSubscriptionManager />;
};
```

## Service Layer

### useUserSubscriptionService

React hook providing subscription management functionality.

**API**:

```typescript
const {
  // Data
  subscriptions, // UserSubscription[]
  paymentMethods, // PaymentMethod[]
  subscriptionHistory, // SubscriptionHistory[]
  loading, // boolean
  error, // string | null

  // Actions
  refreshSubscriptions, // () => Promise<void>
  toggleAutoRenew, // (id, autoRenew) => Promise<void>
  cancelSubscription, // (id) => Promise<void>
  pauseSubscription, // (id) => Promise<void>
  resumeSubscription, // (id) => Promise<void>
  addPaymentMethod, // () => Promise<void>
  updatePaymentMethod, // (id, updates) => Promise<void>
  deletePaymentMethod, // (id) => Promise<void>
  setDefaultPaymentMethod, // (id) => Promise<void>
  updateRenewalSettings, // (id, settings) => Promise<void>
  exportSubscriptionHistory, // () => Promise<string>
} = useUserSubscriptionService();
```

**Environment Modes**:

- **Development**: Uses `MockUserSubscriptionService` with sample data
- **Production**: Uses `ProductionUserSubscriptionService` with real API calls

**Data Validation**:

- All API responses validated with Zod schemas
- Type-safe data transformation
- Comprehensive error handling

## Type Definitions

### Subscription

```typescript
interface Subscription {
  id: string;
  name: string;
  description?: string;
  tierName?: string;
  amount: number; // Satoshis
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  startDate: string;
  endDate: string;
  nextPaymentDate?: string;
  autoRenew: boolean;
  benefits?: string[];
  subscriberCount?: number;
  avatarUrl?: string;
}

type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired' | 'pending';
type BillingInterval = 'monthly' | 'quarterly' | 'yearly';
```

### UserSubscription

```typescript
interface UserSubscription {
  id: string;
  creator_id: string;
  creator_name: string;
  creator_avatar?: string;
  tier_name: string;
  tier_id: string;
  status: SubscriptionStatus;
  amount_sats: number;
  billing_interval: BillingInterval;
  start_date: string;
  end_date: string;
  auto_renew: boolean;
  payment_method_id: string;
  last_payment_date?: string;
  next_payment_date?: string;
  benefits: string[];
  usage_stats?: {
    content_accessed: number;
    total_value_received: number;
  };
}
```

### PaymentMethod

```typescript
interface PaymentMethod {
  id: string;
  type: 'lightning' | 'bitcoin' | 'nostr';
  name: string;
  identifier: string; // Lightning address, Bitcoin address, or NOSTR pubkey
  is_default: boolean;
  is_verified: boolean;
  created_at: string;
  last_used?: string;
  failure_count: number;
}
```

## API Endpoints

### User Subscriptions

| Method | Endpoint                                       | Description                |
| ------ | ---------------------------------------------- | -------------------------- |
| GET    | `/api/user/subscriptions`                      | Get all user subscriptions |
| PATCH  | `/api/user/subscriptions/:id/auto-renew`       | Toggle auto-renewal        |
| POST   | `/api/user/subscriptions/:id/cancel`           | Cancel subscription        |
| POST   | `/api/user/subscriptions/:id/pause`            | Pause subscription         |
| POST   | `/api/user/subscriptions/:id/resume`           | Resume subscription        |
| PATCH  | `/api/user/subscriptions/:id/renewal-settings` | Update renewal settings    |

### Payment Methods

| Method | Endpoint                                    | Description             |
| ------ | ------------------------------------------- | ----------------------- |
| GET    | `/api/user/payment-methods`                 | Get all payment methods |
| POST   | `/api/user/payment-methods`                 | Add new payment method  |
| PATCH  | `/api/user/payment-methods/:id`             | Update payment method   |
| DELETE | `/api/user/payment-methods/:id`             | Delete payment method   |
| POST   | `/api/user/payment-methods/:id/set-default` | Set as default          |

### Subscription History

| Method | Endpoint                                | Description              |
| ------ | --------------------------------------- | ------------------------ |
| GET    | `/api/user/subscription-history`        | Get subscription history |
| GET    | `/api/user/subscription-history/export` | Export history as CSV    |

## Accessibility

All components meet WCAG 2.1 AA standards:

- ✅ **Keyboard Navigation**: All interactive elements accessible via keyboard
- ✅ **Screen Reader Support**: Proper ARIA labels and roles
- ✅ **Focus Indicators**: Visible focus states for all interactive elements
- ✅ **Color Contrast**: Meets minimum 4.5:1 contrast ratio
- ✅ **Semantic HTML**: Proper use of headings, lists, buttons, and landmarks
- ✅ **Error Messaging**: Clear, descriptive error messages

## Testing

### Test Coverage

- **SubscriptionCard**: 95%+ coverage
- **Overall Feature**: 85%+ coverage

### Test Categories

1. **Rendering Tests**: All component states and variants
2. **Interaction Tests**: All user actions (view, edit, pause, resume, cancel)
3. **Accessibility Tests**: WCAG compliance (jest-axe)
4. **Edge Cases**: Missing data, empty states, error handling
5. **Visual States**: Active/inactive highlighting, warning colors

### Running Tests

```bash
# Run all subscription tests
npm test -- subscriptions

# Run SubscriptionCard tests
npm test -- SubscriptionCard.test

# Run with coverage
npm test -- --coverage subscriptions
```

## Performance

- **Lazy Loading**: Components load on demand
- **Memoization**: React.memo for expensive renders
- **Pagination**: Payment history and subscriber lists
- **Caching**: React Query caching with 30s stale time
- **Optimistic Updates**: Immediate UI feedback

## Responsive Design

All components are mobile-first and responsive:

- **Mobile** (320px+): Single column, touch-optimized
- **Tablet** (768px+): Two-column grid
- **Desktop** (1024px+): Three-column grid (where applicable)
- **Large Desktop** (1440px+): Four-column grid with expanded stats

## Security

- 🔒 **HTTPS Only**: All API calls over HTTPS
- 🔑 **JWT Authentication**: Bearer token authentication
- 🛡️ **Input Validation**: Zod schema validation
- 🚫 **XSS Prevention**: Sanitized user input
- 🔐 **Secure Payment Data**: No sensitive payment data stored client-side

## Browser Support

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile Safari (iOS 14+)
- ✅ Chrome for Android

## Future Enhancements

- [ ] **Real-time Updates**: WebSocket for live subscription status
- [ ] **Bulk Operations**: Multi-select for batch actions
- [ ] **Advanced Filtering**: Filter by creator, tier, date range
- [ ] **Analytics Dashboard**: Subscription trends and insights
- [ ] **Notification System**: Email/push for renewals and failures
- [ ] **Tiered Benefits**: Dynamic benefit unlocking based on tier
- [ ] **Gift Subscriptions**: Allow users to gift subscriptions

## Related Documentation

- [Lightning Payment Integration](./lightning-payments.md)
- [NOSTR Protocol Integration](./nostr-integration.md)
- [User Stories](../user-stories.md)
- [API Documentation](../api/README.md)

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines on:

- Adding new subscription features
- Writing tests
- Creating Mermaid diagrams
- Updating documentation

---

**Last Updated**: 2025-10-25
**Maintained By**: Frontend Team
**Story**: PAY-005
