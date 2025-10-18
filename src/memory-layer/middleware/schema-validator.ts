/**
 * Schema Validation Middleware
 * Phase 2: Memory Layer - APIs & Consent Families
 *
 * Uses Ajv to validate request bodies against memory-schema.json
 */

import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { Request, Response, NextFunction } from 'express';
import { createErrorResponse, ErrorCode, getStatusCode } from '../models/error-envelope';
import * as memorySchema from '../validation/memory-schema.json';

/**
 * Initialize Ajv with formats
 */
const ajv = new Ajv({
  allErrors: true, // Collect all errors, not just the first
  strict: false, // Allow OpenAPI/JSON Schema extensions
  removeAdditional: false, // Don't remove additional properties
});

// Add format validators (date-time, uuid, etc.)
addFormats(ajv);

// Compile schemas for each operation
const schemas = {
  store: ajv.compile(memorySchema.definitions.StoreRequest),
  recall: ajv.compile(memorySchema.definitions.RecallQuery),
  distill: ajv.compile(memorySchema.definitions.DistillRequest),
  forget: ajv.compile(memorySchema.definitions.ForgetRequest),
  export: ajv.compile(memorySchema.definitions.ExportRequest),
};

/**
 * Schema type mapping
 */
type SchemaType = keyof typeof schemas;

/**
 * Format Ajv errors into human-readable messages
 */
function formatValidationErrors(errors: ErrorObject[] | null | undefined): Record<string, any> {
  if (!errors || errors.length === 0) {
    return {};
  }

  return {
    validation_errors: errors.map((err) => ({
      field: err.instancePath || err.params.missingProperty || 'root',
      message: err.message,
      params: err.params,
    })),
  };
}

/**
 * Extract operation from path: /v1/{family}/{operation}
 */
function extractOperation(path: string): string | null {
  const match = path.match(/^\/v1\/[^/]+\/([^/?\s]+)/);
  return match ? match[1] : null;
}

/**
 * Determine which schema to use for validation
 */
function getSchemaType(operation: string | null, method: string): SchemaType | null {
  if (!operation) {
    return null;
  }

  // Map operation + method to schema type
  if (operation === 'store' && method === 'POST') {
    return 'store';
  }
  if (operation === 'recall' && method === 'GET') {
    return 'recall';
  }
  if (operation === 'distill' && method === 'POST') {
    return 'distill';
  }
  if (operation === 'forget' && method === 'DELETE') {
    return 'forget';
  }
  if (operation === 'export' && method === 'GET') {
    return 'export';
  }

  return null;
}

/**
 * Schema Validation Middleware
 *
 * Validates request bodies against memory-schema.json using Ajv
 */
export function schemaValidator(req: Request, res: Response, next: NextFunction): void {
  const operation = extractOperation(req.path);
  const schemaType = getSchemaType(operation, req.method);

  // Skip validation if no schema defined for this operation
  if (!schemaType) {
    return next();
  }

  // Get the appropriate schema validator
  const validate = schemas[schemaType];

  // Prepare data for validation
  let data: any;
  if (req.method === 'GET') {
    // For GET requests, validate query parameters
    data = req.query;
  } else {
    // For POST/DELETE, validate request body
    data = req.body;
  }

  // Validate
  const valid = validate(data);

  if (!valid) {
    const traceId = req.get('X-Trace-ID') || 'unknown';
    const errorResponse = createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Request validation failed',
      formatValidationErrors(validate.errors),
      req,
      traceId
    );

    console.warn(`⚠️ VALIDATION: Schema validation failed for ${operation}:`, validate.errors);

    res.status(getStatusCode(ErrorCode.VALIDATION_ERROR)).json(errorResponse);
    return;
  }

  // Validation passed
  next();
}

/**
 * Export schemas for testing
 */
export { schemas };
