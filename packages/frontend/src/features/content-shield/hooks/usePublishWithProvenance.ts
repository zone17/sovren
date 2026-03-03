import type { EventTemplate } from 'nostr-tools/pure';
import { useRef } from 'react';
import { keyManagementService } from '../../../services/nostr/KeyManagementService';
import { useSignProvenance } from './useSignProvenance';

/**
 * Wraps an existing publish callback to optionally sign provenance via NOSTR extension.
 *
 * - If window.nostr is available at publish time: signs via KMS extension, then calls
 *   useSignProvenance to register the provenance record with the API.
 * - If window.nostr is absent: publishes without provenance (graceful degradation).
 * - Uses useRef mutex to prevent double-submit.
 */
export function usePublishWithProvenance(
  contentId: string,
  onPublish: (content: string) => Promise<void>
) {
  const signProvenance = useSignProvenance();
  const savingRef = useRef(false);

  return async (content: string): Promise<void> => {
    if (savingRef.current) return;
    savingRef.current = true;

    try {
      await onPublish(content);

      const hasExtension = typeof window !== 'undefined' && !!window.nostr;
      if (!hasExtension) return;

      // Build a NOSTR text event for the published content
      const eventTemplate: EventTemplate = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'sovren-content']],
        content,
      };

      const signedEvent = await keyManagementService.signWithExtension(eventTemplate);

      // Register provenance with the API
      await signProvenance.mutateAsync({
        content_id: contentId,
        content_body: content,
        nostr_event_id: signedEvent.id,
        signature: signedEvent.sig,
        relays: [],
      });
    } finally {
      savingRef.current = false;
    }
  };
}
