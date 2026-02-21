/**
 * Shared API Response Helper
 *
 * Provides a consistent response envelope across all controllers.
 * Every success response includes: success, data, and metadata
 * (requestId, timestamp, optional processingTime).
 *
 * Automatically transforms snake_case DB rows to camelCase API responses
 * to match shared type contracts (packages/shared/src/types/).
 */

import { Request } from 'express';
import { getCorrelationId } from '../middleware/correlation-id';
import { snakeToCamel } from './case-transform';

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

export interface ApiResponseOptions {
  /** Set to true to skip snake_case → camelCase transformation (data already in camelCase) */
  raw?: boolean;
  /** Optional request start time (Date.now()) for processingTime calculation */
  startTime?: number;
}

/**
 * Creates a standardized API response envelope.
 * Applies snake_case → camelCase transformation by default to match shared type contracts.
 *
 * @param req - Express request (used for correlation context)
 * @param data - The response payload (snake_case from DB will be converted to camelCase)
 * @param optionsOrStartTime - Options object or legacy startTime number
 */
export function createApiResponse<T>(
  req: Request,
  data: T,
  optionsOrStartTime?: ApiResponseOptions | number
): ApiResponse<T> {
  const options: ApiResponseOptions =
    typeof optionsOrStartTime === 'number'
      ? { startTime: optionsOrStartTime }
      : (optionsOrStartTime ?? {});

  const transformedData = options.raw ? data : snakeToCamel<T>(data);

  return {
    success: true,
    data: transformedData,
    metadata: {
      requestId: getCorrelationId(),
      timestamp: new Date().toISOString(),
      ...(options.startTime !== undefined && { processingTime: Date.now() - options.startTime }),
    },
  };
}
