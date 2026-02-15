import { createFeatureErrorBoundary } from '../../monitoring/createFeatureErrorBoundary';

export const NostrErrorBoundary = createFeatureErrorBoundary('NOSTR Protocol');

export default NostrErrorBoundary;
