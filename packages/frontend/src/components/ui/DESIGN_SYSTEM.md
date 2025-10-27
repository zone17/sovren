# 🎨 Sovren Design System

## Architecture Decision Record

**Date:** 2024
**Status:** Implemented
**Decision:** Modernize component system to Stripe/Linear/Vercel caliber standards

### Context

- Previous components used generic CSS variables (`bg-primary`, `text-muted-foreground`)
- Inconsistent border radius (`rounded-md`, `rounded-xl`, `rounded-lg`)
- Poor typography hierarchy and spacing
- No cohesive color system for Lightning/NOSTR/Bitcoin branding

### Decision

Implemented **precision design system** with:

- Real hex colors for predictable results
- Consistent `6px` border radius across all components
- Modern typography with `-0.01em` letter spacing
- Unified shadow system with proper depth hierarchy
- Brand-specific variants (Lightning/Sovereign/Premium)

---

## 🎨 Color System

### Core Colors

```typescript
// Primary Text
'#24292f'; // Main text color - high contrast, readable

// Secondary Text
'#656d76'; // Muted text - perfect for descriptions, labels

// Accent Text
'#1f2937'; // Headers, titles - stronger than primary

// Borders & Backgrounds
'#d1d9e0'; // Clean borders - subtle but defined
'#f6f8fa'; // Light backgrounds - secondary elements
'#f3f4f6'; // Hover states - interactive feedback
```

### Brand Colors

```typescript
// ⚡ Lightning Network (Bitcoin Orange)
'#f7931a'; // Primary bitcoin orange
'#e8851a'; // Hover state
'#d97919'; // Active state

// 🔵 Sovereign (NOSTR Purple)
'#6366f1'; // Primary NOSTR purple
'#5b5fd1'; // Hover state
'#5350c1'; // Active state

// ⚫ Premium (Elite Black)
'#1f2937'; // Primary premium black
'#111827'; // Hover state
'#0f172a'; // Active state
```

### System Colors

```typescript
// Success
'#1a7f37'; // Green for success states
'#f6ffed'; // Success background

// Warning
'#bf8700'; // Amber for warnings
'#fffdf0'; // Warning background

// Error
'#da3633'; // Red for errors
'#fff5f5'; // Error background

// Primary Action
'#0969da'; // GitHub blue for primary actions
'#0860ca'; // Hover state
'#0757ba'; // Active state
```

---

## 📝 Typography Scale

### Font Stack

```css
font-family:
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  'Segoe UI',
  sans-serif;
```

### Text Sizes

```typescript
// Small Text (Labels, badges)
'text-[11px]'; // Badges, micro-copy
'text-[12px]'; // Small labels, helper text

// Body Text
'text-[13px]'; // Primary body text, form inputs
'text-[14px]'; // Large body text

// Headers
'text-lg'; // Dialog titles, card headers
```

### Typography Properties

```typescript
font-weight: 500;           // Medium weight (not bold)
letter-spacing: -0.01em;    // Subtle tightening
line-height: 1;            // Tight leading for buttons/inputs
line-height: 1.4;          // Comfortable reading for body text
```

---

## 🏗️ Spatial System

### Border Radius

```typescript
// Primary Radius (buttons, inputs, cards)
'rounded-[6px]'; // Modern, not too rounded

// Small Radius (badges, inner elements)
'rounded-[4px]'; // Subtle rounding for small components
```

### Component Heights

```typescript
// Buttons & Inputs
'h-7'; // Small (28px)
'h-8'; // Default (32px)
'h-9'; // Large (36px)

// Consistent, not too tall - modern proportions
```

### Shadow System

```typescript
// Subtle Shadows
'shadow-[0_1px_2px_rgba(31,35,40,0.04)]'; // Rest state
'shadow-[0_2px_4px_rgba(31,35,40,0.08)]'; // Hover state

// Elevated Shadows
'shadow-[0_4px_12px_rgba(31,35,40,0.12)]'; // Dialogs, dropdowns
```

---

## 🎯 Component Patterns

### Button Variants

```typescript
// Primary Action
variant = 'default'; // Blue, high contrast
variant = 'lightning'; // Bitcoin orange
variant = 'sovereign'; // NOSTR purple
variant = 'premium'; // Elite black

// Secondary Actions
variant = 'secondary'; // Gray, subtle
variant = 'outline'; // Minimal border
variant = 'ghost'; // Invisible until hover
variant = 'link'; // Text-only action
```

### Input States

```typescript
// Validation States
variant = 'default'; // Clean, neutral
variant = 'success'; // Green accent
variant = 'warning'; // Amber accent
variant = 'error'; // Red accent

// Brand States
variant = 'lightning'; // Bitcoin orange accent
variant = 'sovereign'; // NOSTR purple accent
```

### Micro-Interactions

```typescript
// Button Feedback
'active:translate-y-[0.5px]'; // Subtle press down
'hover:shadow-[...]'; // Elevation increase
'transition-all duration-150'; // Snappy animations

// Input Focus
'focus-visible:ring-2'; // Clear focus indication
'focus-visible:ring-offset-1'; // Proper spacing
'focus-visible:border-[color]'; // Color coordination
```

---

## 🎨 Usage Guidelines

### When to Use Each Variant

**Lightning (Bitcoin Orange)**

- Payment buttons
- Bitcoin-related actions
- Revenue/earnings displays
- Lightning Network features

**Sovereign (NOSTR Purple)**

- Identity/auth actions
- NOSTR protocol features
- Creator profile actions
- Decentralized features

**Premium (Elite Black)**

- Exclusive features
- High-value actions
- Premium creator tools
- Elite tier indicators

### Accessibility Requirements

**Color Contrast**

- All text meets WCAG AA standards (4.5:1 ratio)
- Interactive elements have clear focus states
- Brand colors tested for accessibility

**Keyboard Navigation**

- All interactive elements focusable
- Logical tab order maintained
- Focus indicators clearly visible

**Screen Readers**

- Semantic HTML structure
- Proper ARIA labels where needed
- Clear component naming

---

## 🚀 Performance Considerations

**CSS Optimization**

- Uses arbitrary values for precise control
- Minimal CSS bundle size
- No runtime color calculations

**Component Architecture**

- CVA for optimal class variance
- React.forwardRef for proper ref passing
- TypeScript for type safety

**Bundle Impact**

- Real hex colors (no CSS variable lookups)
- Consistent patterns reduce CSS bloat
- Tree-shakeable component exports

---

## 🔧 Developer Experience

### Import Pattern

```typescript
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
```

### Usage Examples

```typescript
// Primary Action
<Button variant="default">Save Changes</Button>

// Lightning Payment
<Button variant="lightning">Pay 1000 sats</Button>

// NOSTR Authentication
<Button variant="sovereign">Connect NOSTR</Button>

// Premium Feature
<Button variant="premium">Upgrade to Elite</Button>
```

### Customization

```typescript
// Custom styling still supported
<Button
  variant="default"
  className="w-full mb-4"
>
  Custom Button
</Button>

// Size variants
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
```
