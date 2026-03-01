/**
 * 🎯 **COMPONENTS MASTER EXPORTS**
 *
 * Elite Engineering Standards:
 * - Comprehensive component organization
 * - Feature-based exports with UI layer
 * - Maintains backward compatibility
 * - Clear architectural boundaries
 */

// 🎨 **UI COMPONENTS** (preserved hierarchy)
export * from './ui';

// Feature components are imported directly from '@/features/*'

/**
 * 📋 **MIGRATION NOTES**
 *
 * Components are now organized as:
 * - UI Layer: Generic reusable components (Button, Layout, etc.)
 * - Feature Layer: Business logic components (Auth, Content, Analytics, Dashboard)
 *
 * This provides:
 * ✅ Clear separation between UI and business logic
 * ✅ Better testability and maintainability
 * ✅ Easier feature development and scaling
 * ✅ Reduced coupling between modules
 */
