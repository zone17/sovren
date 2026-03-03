import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useProvenanceChain } from '../hooks/useProvenanceChain';

interface ProvenanceChainViewerProps {
  contentId: string;
  onClose: () => void;
}

function truncate(str: string, len = 12): string {
  if (str.length <= len * 2) return str;
  return `${str.slice(0, len)}...${str.slice(-len)}`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    // Clipboard API may be unavailable in insecure contexts
  });
}

export const ProvenanceChainViewer: React.FC<ProvenanceChainViewerProps> = ({
  contentId,
  onClose,
}) => {
  const { data, isLoading, error } = useProvenanceChain(contentId);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Content Provenance</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-4 py-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {error && (
          <p className="text-sm text-gray-500 py-4 text-center">Failed to load provenance data.</p>
        )}

        {data && (
          <div className="space-y-4 py-2">
            {/* Signature Block */}
            <div className="p-3 bg-gray-50 rounded-lg space-y-2">
              <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                Signature
              </h4>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Author</span>
                  <button
                    onClick={() => copyToClipboard(data.author_pubkey)}
                    className="font-mono text-xs text-gray-700 hover:text-blue-600 transition-colors"
                    title="Click to copy"
                    aria-label="Copy author public key"
                  >
                    {truncate(data.author_pubkey)}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Signature</span>
                  <button
                    onClick={() => copyToClipboard(data.signature)}
                    className="font-mono text-xs text-gray-700 hover:text-blue-600 transition-colors"
                    title="Click to copy"
                    aria-label="Copy signature"
                  >
                    {truncate(data.signature)}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Content Hash</span>
                  <button
                    onClick={() => copyToClipboard(data.content_hash)}
                    className="font-mono text-xs text-gray-700 hover:text-blue-600 transition-colors"
                    title="Click to copy"
                    aria-label="Copy content hash"
                  >
                    {truncate(data.content_hash)}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Timestamp</span>
                  <span className="text-xs text-gray-700">
                    {new Date(data.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Relay Confirmations */}
            <div className="p-3 bg-gray-50 rounded-lg space-y-2">
              <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                Relay Confirmations ({data.relay_confirmations.length})
              </h4>

              {data.relay_confirmations.length === 0 ? (
                <p className="text-xs text-gray-400">No relay confirmations yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {data.relay_confirmations.map((conf) => (
                    <div key={conf.relay} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full bg-green-500 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="text-xs text-gray-700 font-mono">{conf.relay}</span>
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {new Date(conf.confirmed_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* NIP-05 */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-xs font-medium text-gray-600">NIP-05 Verification</span>
              <Badge
                className={
                  data.nip05_verified ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }
              >
                {data.nip05_verified ? 'Verified' : 'Not Verified'}
              </Badge>
            </div>

            {/* Event ID */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">NOSTR Event</span>
              <button
                onClick={() => copyToClipboard(data.nostr_event_id)}
                className="font-mono text-xs text-gray-700 hover:text-blue-600 transition-colors"
                title="Click to copy"
                aria-label="Copy NOSTR event ID"
              >
                {truncate(data.nostr_event_id)}
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
