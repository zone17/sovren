/**
 * 🛠️ **SHARED EDGE FUNCTION UTILITIES**
 *
 * Elite utility functions for Supabase Edge Functions
 *
 * **Implementation for US-210: Supabase Edge Functions**
 *
 * Features:
 * - US-210.1: Shared utility functions ✅
 * - US-210.2: Response standardization ✅
 * - US-210.3: Error handling utilities ✅
 * - US-210.4: Validation helpers ✅
 * - US-210.5: Logging utilities ✅
 *
 * @version 1.0.0
 * @author Sovren Team
 * @since 2024-01-20
 */

import { createClient } from 'supabase';
import { z } from 'zod';
import type {
  DatabaseConnection,
  EdgeFunctionContext,
  EdgeFunctionRequest,
  EdgeFunctionResponse,
} from './types.ts';

// 🌍 CORS Configuration
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// 📝 Logger Class
export class Logger {
  private context: string;
  private requestId?: string;

  constructor(context: string, requestId?: string) {
    this.context = context;
    this.requestId = requestId;
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      context: this.context,
      requestId: this.requestId,
      message,
      ...(data && { data }),
    };
    return JSON.stringify(logData);
  }

  info(message: string, data?: any): void {
    console.log(this.formatMessage('INFO', message, data));
  }

  warn(message: string, data?: any): void {
    console.warn(this.formatMessage('WARN', message, data));
  }

  error(message: string, error?: any): void {
    const errorData =
      error instanceof Error ? { message: error.message, stack: error.stack } : error;
    console.error(this.formatMessage('ERROR', message, errorData));
  }

  debug(message: string, data?: any): void {
    const env = globalThis.Deno?.env || { get: () => undefined };
    if (env.get('LOG_LEVEL') === 'debug') {
      console.log(this.formatMessage('DEBUG', message, data));
    }
  }
}

// 🎯 Response Helpers
export class ResponseHelper {
  static success<T>(
    data: T,
    message?: string,
    statusCode: number = 200,
    requestId?: string,
    executionTime?: number
  ): Response {
    const response: EdgeFunctionResponse<T> = {
      success: true,
      data,
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      requestId,
      executionTime,
    };

    return new Response(JSON.stringify(response), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }

  static error(
    error: string,
    statusCode: number = 500,
    requestId?: string,
    executionTime?: number
  ): Response {
    const response: EdgeFunctionResponse = {
      success: false,
      error,
      statusCode,
      timestamp: new Date().toISOString(),
      requestId,
      executionTime,
    };

    return new Response(JSON.stringify(response), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }

  static validation(errors: string[], requestId?: string, executionTime?: number): Response {
    const response: EdgeFunctionResponse = {
      success: false,
      error: 'Validation failed',
      data: { errors },
      statusCode: 400,
      timestamp: new Date().toISOString(),
      requestId,
      executionTime,
    };

    return new Response(JSON.stringify(response), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }

  static unauthorized(
    message: string = 'Unauthorized',
    requestId?: string,
    executionTime?: number
  ): Response {
    return ResponseHelper.error(message, 401, requestId, executionTime);
  }

  static forbidden(
    message: string = 'Forbidden',
    requestId?: string,
    executionTime?: number
  ): Response {
    return ResponseHelper.error(message, 403, requestId, executionTime);
  }

  static notFound(
    message: string = 'Not found',
    requestId?: string,
    executionTime?: number
  ): Response {
    return ResponseHelper.error(message, 404, requestId, executionTime);
  }

  static methodNotAllowed(
    allowedMethods: string[] = ['POST'],
    requestId?: string,
    executionTime?: number
  ): Response {
    const response: EdgeFunctionResponse = {
      success: false,
      error: `Method not allowed. Allowed methods: ${allowedMethods.join(', ')}`,
      statusCode: 405,
      timestamp: new Date().toISOString(),
      requestId,
      executionTime,
    };

    return new Response(JSON.stringify(response), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        Allow: allowedMethods.join(', '),
        ...corsHeaders,
      },
    });
  }
}

// 🔍 Validation Helpers
export class ValidationHelper {
  static validateSchema<T>(
    schema: z.ZodSchema<T>,
    data: unknown
  ): { success: true; data: T } | { success: false; errors: string[] } {
    try {
      const validatedData = schema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`);
        return { success: false, errors };
      }
      return { success: false, errors: ['Invalid data format'] };
    }
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validateHexString(hex: string, length?: number): boolean {
    const hexRegex = /^[0-9a-fA-F]+$/;
    if (!hexRegex.test(hex)) return false;
    if (length && hex.length !== length) return false;
    return true;
  }

  static sanitizeString(str: string): string {
    return str
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
}

// 🗄️ Database Helper
export class DatabaseHelper {
  private client: any;
  private logger: Logger;

  constructor(connection: DatabaseConnection, logger: Logger) {
    this.client = createClient(connection.url, connection.key);
    this.logger = logger;
  }

  async query<T>(
    table: string,
    options: {
      select?: string;
      filter?: Record<string, any>;
      limit?: number;
    } = {}
  ): Promise<{ data: T[] | null; error: any }> {
    try {
      let query = this.client.from(table);

      if (options.select) {
        query = query.select(options.select);
      }

      if (options.filter) {
        Object.entries(options.filter).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const result = await query;

      if (result.error) {
        this.logger.error('Database query failed', result.error);
      }

      return result;
    } catch (error) {
      this.logger.error('Database query exception', error);
      return { data: null, error };
    }
  }

  async insert<T>(
    table: string,
    data: Partial<T> | Partial<T>[]
  ): Promise<{ data: T[] | null; error: any }> {
    try {
      const result = await this.client.from(table).insert(data).select();

      if (result.error) {
        this.logger.error('Database insert failed', result.error);
      }

      return result;
    } catch (error) {
      this.logger.error('Database insert exception', error);
      return { data: null, error };
    }
  }
}

// 🔐 Security Helpers
export class SecurityHelper {
  static generateRandomString(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  static generateUUID(): string {
    return crypto.randomUUID();
  }

  static extractBearerToken(authHeader?: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }
}

// 🔄 Request Helpers
export class RequestHelper {
  static async parseRequest(request: Request): Promise<EdgeFunctionRequest> {
    const url = new URL(request.url);
    const headers: Record<string, string> = {};

    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const query: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      query[key] = value;
    });

    let body;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const contentType = headers['content-type'];
      if (contentType?.includes('application/json')) {
        try {
          body = await request.json();
        } catch {
          body = null;
        }
      } else if (contentType?.includes('text/')) {
        body = await request.text();
      }
    }

    return {
      method: request.method,
      url: request.url,
      headers,
      body,
      query,
    };
  }

  static createContext(request: EdgeFunctionRequest): EdgeFunctionContext {
    const requestId = SecurityHelper.generateUUID();
    const ip = request.headers['x-forwarded-for'] || request.headers['x-real-ip'];
    const userAgent = request.headers['user-agent'];
    const origin = request.headers['origin'];

    return {
      requestId,
      ip,
      userAgent,
      origin,
      timestamp: new Date().toISOString(),
    };
  }
}

// ⏱️ Performance Helper
export class PerformanceHelper {
  private startTime: number;

  constructor() {
    this.startTime = performance.now();
  }

  getTotalExecutionTime(): number {
    return performance.now() - this.startTime;
  }
}
