import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useProvenanceChain } from '../hooks/useProvenanceChain';
import type { VerificationStatus } from '../types';
import { ProvenanceChainViewer } from './ProvenanceChainViewer';

const STATUS_CONFIG: Record<VerificationStatus, { icon: string; label: string; color: string }> = {
  verified: { icon: 'V', label: 'Verified', color: 'text-green-600 bg-green-50 border-green-200' },
  unverified: { icon: '?', label: 'Unverified', color: 'text-gray-500 bg-gray-50 border-gray-200' },
  disputed: { icon: '!', label: 'Disputed', color: 'text-red-600 bg-red-50 border-red-200' },
};

interface AuthenticityBadgeProps {
  contentId: string;
}

// TODO(#620): N+1 — each badge fires its own useProvenanceChain query.
// Accept for MVP (2 mock items, staleTime 5min). When real data is wired,
// replace with POST /api/v2/shield/provenance/batch accepting contentId[].
export const AuthenticityBadge: React.FC<AuthenticityBadgeProps> = ({ contentId }) => {
  const { data, isLoading, isError } = useProvenanceChain(contentId);
  const [showProvenance, setShowProvenance] = useState(false);

  if (isLoading) {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 animate-pulse" />
    );
  }

  if (isError) {
    return (
      <span className="inline-flex items-center text-gray-400" title="Verification unavailable">
        <HelpCircle className="h-4 w-4" />
      </span>
    );
  }

  if (!data) return null;

  const config = STATUS_CONFIG[data.verification_status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setShowProvenance(true)}
            className={`inline-flex items-center justify-center w-5 h-5 rounded-full border text-[10px] font-bold ${config.color} hover:opacity-80 transition-opacity`}
            aria-label={`Content ${config.label}. Click for provenance details.`}
          >
            {config.icon}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {config.label}
          {data.nip05_verified && ' (NIP-05)'}
        </TooltipContent>
      </Tooltip>

      {showProvenance && (
        <ProvenanceChainViewer contentId={contentId} onClose={() => setShowProvenance(false)} />
      )}
    </TooltipProvider>
  );
};
