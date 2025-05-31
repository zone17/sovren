import { z } from 'zod';

// 📊 ELITE VALIDATION RESULT INTERFACE
interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

// 🔧 Enhanced validation options
interface ValidationOptions {
  stripUnknown?: boolean;
  maxFieldLength?: number;
  allowedFields?: string[];
  sanitize?: boolean;
}

// 🧹 SECURITY: Input sanitization
const sanitizeInput = (obj: any): any => {
  if (typeof obj === 'string') {
    return obj
      .trim()
      .replace(/[<>]/g, '') // Basic XSS protection
      .substring(0, 10000); // Prevent DoS via large strings
  }

  if (Array.isArray(obj)) {
    return obj.slice(0, 100).map(sanitizeInput); // Limit array size
  }

  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    const entries = Object.entries(obj).slice(0, 50); // Limit object size

    for (const [key, value] of entries) {
      if (typeof key === 'string' && key.length <= 100) {
        sanitized[key] = sanitizeInput(value);
      }
    }

    return sanitized;
  }

  return obj;
};

// 🛡️ ELITE REQUEST VALIDATION
export function validateRequest<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  options: ValidationOptions = {}
): ValidationResult<T> {
  try {
    // 🧹 Security sanitization
    const sanitizedData = options.sanitize !== false ? sanitizeInput(data) : data;

    // 📊 Field length validation
    if (options.maxFieldLength) {
      const fieldLengthCheck = checkFieldLengths(sanitizedData, options.maxFieldLength);
      if (!fieldLengthCheck.success) {
        return fieldLengthCheck;
      }
    }

    // 🎯 Allowed fields filtering
    const filteredData = options.allowedFields
      ? filterAllowedFields(sanitizedData, options.allowedFields)
      : sanitizedData;

    // 📋 Zod validation
    const result = schema.safeParse(filteredData);

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }

    // 🚨 Format validation errors
    const errors = result.error.errors.map((err) => ({
      field: err.path.join('.') || 'root',
      message: err.message,
      code: err.code,
    }));

    return {
      success: false,
      errors,
    };

  } catch (error) {
    console.error('Validation error:', error);

    return {
      success: false,
      errors: [{
        field: 'validation',
        message: 'Invalid input format',
        code: 'VALIDATION_ERROR',
      }],
    };
  }
}

// 📏 Field length validation
function checkFieldLengths(data: any, maxLength: number): ValidationResult<any> {
  if (typeof data === 'string' && data.length > maxLength) {
    return {
      success: false,
      errors: [{
        field: 'input',
        message: `Field exceeds maximum length of ${maxLength}`,
        code: 'FIELD_TOO_LONG',
      }],
    };
  }

  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      const result = checkFieldLengths(data[i], maxLength);
      if (!result.success) {
        return result;
      }
    }
  }

  if (data && typeof data === 'object') {
    for (const [key, value] of Object.entries(data)) {
      if (key.length > 100) {
        return {
          success: false,
          errors: [{
            field: key,
            message: 'Field name too long',
            code: 'FIELD_NAME_TOO_LONG',
          }],
        };
      }

      const result = checkFieldLengths(value, maxLength);
      if (!result.success) {
        return result;
      }
    }
  }

  return { success: true };
}

// 🎯 Filter only allowed fields
function filterAllowedFields(data: any, allowedFields: string[]): any {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return data;
  }

  const filtered: any = {};
  for (const field of allowedFields) {
    if (field in data) {
      filtered[field] = data[field];
    }
  }

  return filtered;
}

// 📧 ELITE EMAIL VALIDATION
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .min(1, 'Email is required')
  .max(254, 'Email too long')
  .transform((val) => val.toLowerCase().trim());

// 🔑 ELITE PASSWORD VALIDATION
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// 👤 USER NAME VALIDATION
export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name too long')
  .regex(/^[a-zA-Z\s\-'\.]+$/, 'Name contains invalid characters')
  .transform((val) => val.trim().replace(/\s+/g, ' '));

// 📝 CONTENT VALIDATION
export const contentSchema = z
  .string()
  .min(1, 'Content is required')
  .max(50000, 'Content too long')
  .transform((val) => val.trim());

// 💰 PAYMENT AMOUNT VALIDATION
export const amountSchema = z
  .number()
  .positive('Amount must be positive')
  .max(1000000, 'Amount too large')
  .multipleOf(0.01, 'Amount must have at most 2 decimal places');

// 🆔 UUID VALIDATION
export const uuidSchema = z
  .string()
  .uuid('Invalid UUID format');

// 📱 PHONE VALIDATION
export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
  .optional();

// 🌐 URL VALIDATION
export const urlSchema = z
  .string()
  .url('Invalid URL format')
  .max(2048, 'URL too long')
  .optional();

// 🧪 Testing utilities
export const __testing = {
  sanitizeInput,
  checkFieldLengths,
  filterAllowedFields,
};
