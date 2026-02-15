/**
 * Shared API Response Helper
 *
 * Provides a consistent response envelope across all controllers.
 * Every success response includes: success, data, and metadata
 * (requestId, timestamp, optional processingTime).
 */

import { Request } from 'express';
import { getCorrelationId } from '../middleware/correlation-id';

export interface ApiResponseMetadata {
  requestId: string;
  timestamp: string;
  processingTime?: number;
}

export interface ApiResponse<T> {
  success: true;
  data: T;
  metadata: ApiResponseMetadata;
}

/**
 * Creates a standardized API response envelope.
 *
 * @param req - Express request (used for correlation context)
 * @param data - The response payload
 * @param startTime - Optional request start time (Date.now()) for processingTime calculation
 */
export function createApiResponse<T>(req: Request, data: T, startTime?: number): ApiResponse<T> {
  return {
    success: true,
    data,
    metadata: {
      requestId: getCorrelationId(),
      timestamp: new Date().toISOString(),
      ...(startTime !== undefined && { processingTime: Date.now() - startTime }),
    },
  };
}
