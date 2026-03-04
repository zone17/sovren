import type { EventTemplate } from 'nostr-tools/pure';
import { useEffect, useRef } from 'react';
import { keyManagementService } from '../../../services/nostr/KeyManagementService';
import { useSignProvenance } from './useSignProvenance';

/**
 * Wraps an existing publish callback to optionally sign provenance via NOSTR extension.
 *
 * - If window.nostr is available at publish time: signs via KMS extension, then calls
 *   useSignProvenance to register the provenance record with the API.
 * - If window.nostr is absent: publishes without provenance (graceful degradation).
 * - Uses useRef mutex to prevent double-submit.
 * - Provenance errors are caught and logged — they never block publish (#618).
 * - Checks mountedRef between async steps to prevent ghost writes (#611).
 */
export function usePublishWithProvenance(
  contentId: string,
  onPublish: (content: string) => Promise<void>
) {
  const signProvenance = useSignProvenance();
  const savingRef = useRef(false);
  const mountedRef = useRef(true);
  const contentIdRef = useRef(contentId);
  const onPublishRef = useRef(onPublish);

  // Keep refs fresh on every render (#611 — stale closure fix)
  contentIdRef.current = contentId;
  onPublishRef.current = onPublish;

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  return async (content: string): Promise<void> => {
    if (savingRef.current) return;
    savingRef.current = true;

    try {
      await onPublishRef.current(content);

      // Provenance signing is optional — errors must not block publish (#618)
      try {
        if (!mountedRef.current) return;

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

        if (!mountedRef.current) return;

        // Register provenance with the API — send event_created_at for verification (#609)
        await signProvenance.mutateAsync({
          content_id: contentIdRef.current,
          content_body: content,
          nostr_event_id: signedEvent.id,
          signature: signedEvent.sig,
          relays: [],
          event_created_at: eventTemplate.created_at,
        });
      } catch (provenanceError) {
        console.warn('Provenance signing failed — content was still published', provenanceError);
      }
    } finally {
      savingRef.current = false;
    }
  };
}
