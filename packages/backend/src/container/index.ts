/**
 * DI Container Barrel Export
 *
 * Provides a singleton container instance for route modules.
 * The container is lazily initialized via bootstrapApplication()
 * and exported for use by v1 route files.
 *
 * IMPORTANT: bootstrap.ts is imported dynamically to avoid pulling
 * the entire service dependency chain at module load time.
 */

import type { IServiceContainer } from '../interfaces/shared/IServiceRegistry';
import { TYPES } from './types';

let _container: IServiceContainer | null = null;

/**
 * Initialize the DI container. Must be called once at startup
 * before any route modules attempt to resolve services.
 */
export async function initializeContainer(): Promise<IServiceContainer> {
  if (_container) {
    return _container;
  }

  // Dynamic import to avoid triggering the full binding chain at module load time
  const { bootstrapApplication } = await import('../bootstrap');

  const result = await bootstrapApplication({
    enableHealthChecks: false,
    logStartup: process.env.NODE_ENV !== 'test',
  });

  _container = result.container;
  return _container;
}

/**
 * Set the container directly (for testing purposes).
 */
export function setContainer(c: IServiceContainer): void {
  _container = c;
}

/**
 * Get the current container instance.
 * Returns a proxy that defers resolution until the container is initialized.
 * This allows route files to import at module load time while the container
 * is initialized asynchronously during server startup.
 */
export const container: IServiceContainer = new Proxy({} as IServiceContainer, {
  get(_target, prop) {
    if (!_container) {
      // Return a lazy resolver for the 'get' method used by route files
      if (prop === 'resolve') {
        return (token: any) => {
          if (!_container) {
            throw new Error(
              `DI container not initialized. Call initializeContainer() before resolving services. Attempted to resolve: ${token?.name || token}`
            );
          }
          return _container.resolve(token);
        };
      }
      return undefined;
    }

    const value = (_container as any)[prop];
    if (typeof value === 'function') {
      return value.bind(_container);
    }
    return value;
  },
});

/**
 * Reset the container (for testing purposes only)
 */
export function resetContainer(): void {
  if (_container) {
    _container.dispose().catch(() => {});
    _container = null;
  }
}

export { TYPES };
