/**
 * Mock Event Bus for Testing
 * Simple in-memory event bus implementation
 */

import type { IEventBusService } from '../../interfaces/shared/IEventBusService';

export function createMockEventBus(config?: { real?: boolean }): IEventBusService {
  const subscribers = new Map<string, Array<(event: any) => void | Promise<void>>>();
  const publishedEvents: Array<{ event: string; payload: any; timestamp: Date }> = [];

  return {
    publish: async <T>(event: string, payload: T): Promise<void> => {
      publishedEvents.push({ event, payload, timestamp: new Date() });

      const handlers = subscribers.get(event) || [];
      const wildcardHandlers = subscribers.get(`${event.split('.')[0]}.*`) || [];
      const allHandlers = [...handlers, ...wildcardHandlers];

      await Promise.all(allHandlers.map((handler) => handler(payload)));
    },

    subscribe: <T>(event: string, handler: (payload: T) => void | Promise<void>): void => {
      if (!subscribers.has(event)) {
        subscribers.set(event, []);
      }
      subscribers.get(event)!.push(handler);
    },

    unsubscribe: (event: string, handler: (payload: any) => void): void => {
      const handlers = subscribers.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    },

    getPublishedEvents: () => publishedEvents,
    getSubscribers: (event: string) => subscribers.get(event)?.length || 0,
    clear: () => {
      subscribers.clear();
      publishedEvents.length = 0;
    },
  };
}
