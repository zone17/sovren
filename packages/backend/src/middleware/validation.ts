import { NextFunction, Request, Response } from 'express';
import { AnyZodObject } from 'zod';

/**
 * Middleware for validating requests against a Zod schema
 *
 * @param schema The Zod schema to validate against
 * @returns Express middleware function
 */
export const validateRequest = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body against schema
      const validatedData = await schema.parseAsync(req.body);

      // Replace request body with validated data
      req.body = validatedData;

      // Continue to next middleware
      next();
    } catch (error: any) {
      // Return validation errors
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors || error.message,
      });
    }
  };
};
