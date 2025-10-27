/**
 * 📸 **ELITE BUTTON SNAPSHOT TESTS**
 *
 * **Purpose**: Comprehensive snapshot testing for Button component
 * **Architecture**: Using our elite snapshot testing utilities
 * **Security**: Safe test snapshots without sensitive data
 * **Performance**: Fast snapshot generation and comparison
 *
 * @author Elite Engineering Team
 * @version 1.0.0 - US-201 Test Infrastructure Repair
 * @lastModified 2024-12-28
 */

import {
  createComprehensiveSnapshots,
  SnapshotTestCase,
  useSnapshotTesting,
} from '../../../test-utils/snapshot-testing';
import { Button } from '../button';

describe('Button Component Snapshots', () => {
  const { createSnapshot, createTestSuite } = useSnapshotTesting();

  // 🎯 **BASIC SNAPSHOT TESTS**
  describe('Basic Button Variants', () => {
    const basicTestCases: SnapshotTestCase[] = [
      {
        name: 'default variant',
        component: <Button>Default Button</Button>,
      },
      {
        name: 'primary variant',
        component: <Button variant="default">Primary Button</Button>,
      },
      {
        name: 'destructive variant',
        component: <Button variant="destructive">Delete</Button>,
      },
      {
        name: 'outline variant',
        component: <Button variant="outline">Outline</Button>,
      },
      {
        name: 'secondary variant',
        component: <Button variant="secondary">Secondary</Button>,
      },
      {
        name: 'ghost variant',
        component: <Button variant="ghost">Ghost</Button>,
      },
      {
        name: 'link variant',
        component: <Button variant="link">Link</Button>,
      },
      {
        name: 'lightning variant',
        component: <Button variant="lightning">⚡ Lightning</Button>,
      },
      {
        name: 'sovereign variant',
        component: <Button variant="sovereign">🔵 Sovereign</Button>,
      },
      {
        name: 'premium variant',
        component: <Button variant="premium">Premium</Button>,
      },
    ];

    createTestSuite('Button Variants', basicTestCases);
  });

  // 🎯 **SIZE VARIANTS**
  describe('Button Sizes', () => {
    const sizeTestCases: SnapshotTestCase[] = [
      {
        name: 'small size',
        component: <Button size="sm">Small</Button>,
      },
      {
        name: 'default size',
        component: <Button size="default">Default</Button>,
      },
      {
        name: 'large size',
        component: <Button size="lg">Large</Button>,
      },
      {
        name: 'icon size',
        component: <Button size="icon">🏠</Button>,
      },
    ];

    createTestSuite('Button Sizes', sizeTestCases);
  });

  // 🎯 **LOADING AND DISABLED STATES**
  describe('Button States', () => {
    const stateTestCases: SnapshotTestCase[] = [
      {
        name: 'loading state',
        component: <Button isLoading>Loading...</Button>,
      },
      {
        name: 'disabled state',
        component: <Button disabled>Disabled</Button>,
      },
      {
        name: 'loading and disabled',
        component: (
          <Button isLoading disabled>
            Loading Disabled
          </Button>
        ),
      },
      {
        name: 'loading with different variants',
        component: (
          <div className="space-y-2">
            <Button isLoading variant="default">
              Default Loading
            </Button>
            <Button isLoading variant="destructive">
              Destructive Loading
            </Button>
            <Button isLoading variant="lightning">
              Lightning Loading
            </Button>
          </div>
        ),
      },
    ];

    createTestSuite('Button States', stateTestCases);
  });

  // 🎯 **COMPREHENSIVE SNAPSHOTS**
  describe('Comprehensive Button Tests', () => {
    it('creates comprehensive snapshots for default button', () => {
      createComprehensiveSnapshots(<Button>Default Button</Button>, {
        serializer: {
          removeDynamicAttributes: true,
          removeDates: true,
          textReplacements: {
            'Default Button': 'BUTTON_TEXT',
          },
        },
      });
    });

    it('creates comprehensive snapshots for lightning button', () => {
      createComprehensiveSnapshots(<Button variant="lightning">⚡ Lightning Payment</Button>, {
        serializer: {
          removeDynamicAttributes: true,
          removeDates: true,
          textReplacements: {
            '⚡ Lightning Payment': 'LIGHTNING_BUTTON_TEXT',
          },
        },
      });
    });

    it('creates comprehensive snapshots for loading button', () => {
      createComprehensiveSnapshots(
        <Button isLoading variant="sovereign">
          Processing...
        </Button>,
        {
          serializer: {
            removeDynamicAttributes: true,
            removeDates: true,
            removeStyles: true, // Remove animation styles for consistent snapshots
            textReplacements: {
              'Processing...': 'PROCESSING_TEXT',
            },
          },
        }
      );
    });
  });

  // 🎯 **BUTTON COMBINATIONS**
  describe('Button Combinations', () => {
    const combinationTestCases: SnapshotTestCase[] = [
      {
        name: 'button group horizontal',
        component: (
          <div className="flex space-x-2">
            <Button variant="outline">Cancel</Button>
            <Button variant="default">Save</Button>
            <Button variant="destructive">Delete</Button>
          </div>
        ),
      },
      {
        name: 'button group vertical',
        component: (
          <div className="flex flex-col space-y-2">
            <Button variant="default">Primary Action</Button>
            <Button variant="secondary">Secondary Action</Button>
            <Button variant="ghost">Tertiary Action</Button>
          </div>
        ),
      },
      {
        name: 'bitcoin lightning actions',
        component: (
          <div className="flex flex-col space-y-2">
            <Button variant="lightning">⚡ Send Lightning</Button>
            <Button variant="sovereign">🔵 Create Invoice</Button>
            <Button variant="premium">💎 Premium Features</Button>
          </div>
        ),
      },
    ];

    createTestSuite('Button Combinations', combinationTestCases);
  });

  // 🎯 **CUSTOM PROPS AND ATTRIBUTES**
  describe('Button Custom Props', () => {
    it('renders with custom className', () => {
      createSnapshot(<Button className="custom-button-class">Custom Button</Button>, {
        name: 'custom-className',
        serializer: {
          removeDynamicAttributes: true,
          removeClasses: false, // Keep classes to test className prop
        },
      });
    });

    it('renders with custom onClick handler', () => {
      const mockOnClick = jest.fn();
      createSnapshot(<Button onClick={mockOnClick}>Clickable Button</Button>, {
        name: 'with-onClick',
        serializer: {
          removeDynamicAttributes: true,
          attributeFilters: ['onclick'], // Remove click handler from snapshot
        },
      });
    });

    it('renders with custom data attributes', () => {
      createSnapshot(
        <Button data-testid="custom-button" data-analytics="button-click">
          Analytics Button
        </Button>,
        {
          name: 'with-data-attributes',
          serializer: {
            removeDynamicAttributes: false, // Keep data attributes for this test
          },
        }
      );
    });
  });

  // 🎯 **ACCESSIBILITY FOCUSED TESTS**
  describe('Button Accessibility', () => {
    it('renders with proper ARIA attributes', () => {
      createSnapshot(
        <Button
          aria-label="Save document"
          aria-describedby="save-description"
          role="button"
          tabIndex={0}
        >
          Save
        </Button>,
        {
          name: 'aria-attributes',
          serializer: {
            removeDynamicAttributes: false,
            attributeFilters: [], // Keep all attributes for accessibility test
          },
        }
      );
    });

    it('renders disabled button with proper accessibility', () => {
      createSnapshot(
        <Button disabled aria-label="Disabled action">
          Disabled Action
        </Button>,
        {
          name: 'disabled-accessibility',
          serializer: {
            removeDynamicAttributes: false,
          },
        }
      );
    });

    it('renders loading button with proper accessibility', () => {
      createSnapshot(
        <Button isLoading aria-label="Loading action">
          Loading Action
        </Button>,
        {
          name: 'loading-accessibility',
          serializer: {
            removeDynamicAttributes: false,
            removeStyles: true, // Remove animation styles for consistent snapshots
          },
        }
      );
    });
  });

  // 🎯 **EDGE CASES**
  describe('Button Edge Cases', () => {
    const edgeCaseTestCases: SnapshotTestCase[] = [
      {
        name: 'empty button',
        component: <Button></Button>,
      },
      {
        name: 'button with only icon',
        component: <Button size="icon">🏠</Button>,
      },
      {
        name: 'button with long text',
        component: <Button>This is a very long button text that might wrap or truncate</Button>,
      },
      {
        name: 'button with special characters',
        component: <Button>Save & Continue → Next</Button>,
      },
      {
        name: 'button with numbers and symbols',
        component: <Button>$50.00 - Process Payment</Button>,
      },
      {
        name: 'button with mixed content',
        component: (
          <Button>
            <span className="mr-2">💡</span>
            Smart Action
            <span className="ml-2">⚡</span>
          </Button>
        ),
      },
    ];

    createTestSuite('Button Edge Cases', edgeCaseTestCases);
  });
});
