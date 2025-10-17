/**
 * Simple Aggregator for Distill Operations
 * Phase 2: Memory Layer - APIs & Consent Families
 *
 * Provides basic aggregation functions for cohort and population queries.
 * Enforces k-anonymity to protect privacy.
 */

import { MemoryRecord } from '../models/memory-record';
import { AggregationType } from '../models/operation-requests';

/**
 * Minimum number of records required for aggregation (k-anonymity)
 */
export const DEFAULT_K_ANONYMITY = 5;

/**
 * Aggregation result structure
 */
export interface AggregationResult {
  type: AggregationType;
  value: number | Record<string, number>;
  record_count: number;
  meets_k_anonymity: boolean;
  min_k: number;
}

/**
 * Check if aggregation meets k-anonymity threshold
 */
export function meetsKAnonymity(recordCount: number, minK: number = DEFAULT_K_ANONYMITY): boolean {
  return recordCount >= minK;
}

/**
 * Count aggregation
 * Returns total number of records
 */
export function count(records: MemoryRecord[], minK: number = DEFAULT_K_ANONYMITY): AggregationResult {
  const recordCount = records.length;
  const meetsThreshold = meetsKAnonymity(recordCount, minK);

  return {
    type: 'count',
    value: meetsThreshold ? recordCount : 0,
    record_count: recordCount,
    meets_k_anonymity: meetsThreshold,
    min_k: minK,
  };
}

/**
 * Extract numeric value from memory record content
 * Supports both direct numeric data and structured content with specified field
 */
function extractNumericValue(record: MemoryRecord, field?: string): number | null {
  const { content } = record;

  // For structured content with field specified
  if (content.type === 'structured' && field) {
    const data = content.data as Record<string, any>;
    const value = field.split('.').reduce((obj, key) => obj?.[key], data);
    return typeof value === 'number' ? value : null;
  }

  // For direct numeric data
  if (typeof content.data === 'number') {
    return content.data;
  }

  // For text content, try to parse as number
  if (content.type === 'text' && typeof content.data === 'string') {
    const parsed = parseFloat(content.data);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}

/**
 * Average aggregation
 * Returns average of numeric values
 */
export function average(
  records: MemoryRecord[],
  field?: string,
  minK: number = DEFAULT_K_ANONYMITY
): AggregationResult {
  const recordCount = records.length;
  const meetsThreshold = meetsKAnonymity(recordCount, minK);

  if (!meetsThreshold) {
    return {
      type: 'average',
      value: 0,
      record_count: recordCount,
      meets_k_anonymity: false,
      min_k: minK,
    };
  }

  const numericValues = records
    .map((r) => extractNumericValue(r, field))
    .filter((v): v is number => v !== null);

  if (numericValues.length === 0) {
    return {
      type: 'average',
      value: 0,
      record_count: recordCount,
      meets_k_anonymity: meetsThreshold,
      min_k: minK,
    };
  }

  const avg = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;

  return {
    type: 'average',
    value: Math.round(avg * 100) / 100, // Round to 2 decimal places
    record_count: recordCount,
    meets_k_anonymity: meetsThreshold,
    min_k: minK,
  };
}

/**
 * Sum aggregation
 * Returns sum of numeric values
 */
export function sum(
  records: MemoryRecord[],
  field?: string,
  minK: number = DEFAULT_K_ANONYMITY
): AggregationResult {
  const recordCount = records.length;
  const meetsThreshold = meetsKAnonymity(recordCount, minK);

  if (!meetsThreshold) {
    return {
      type: 'sum',
      value: 0,
      record_count: recordCount,
      meets_k_anonymity: false,
      min_k: minK,
    };
  }

  const numericValues = records
    .map((r) => extractNumericValue(r, field))
    .filter((v): v is number => v !== null);

  const total = numericValues.reduce((sum, val) => sum + val, 0);

  return {
    type: 'sum',
    value: Math.round(total * 100) / 100,
    record_count: recordCount,
    meets_k_anonymity: meetsThreshold,
    min_k: minK,
  };
}

/**
 * Min aggregation
 * Returns minimum of numeric values
 */
export function min(
  records: MemoryRecord[],
  field?: string,
  minK: number = DEFAULT_K_ANONYMITY
): AggregationResult {
  const recordCount = records.length;
  const meetsThreshold = meetsKAnonymity(recordCount, minK);

  if (!meetsThreshold) {
    return {
      type: 'min',
      value: 0,
      record_count: recordCount,
      meets_k_anonymity: false,
      min_k: minK,
    };
  }

  const numericValues = records
    .map((r) => extractNumericValue(r, field))
    .filter((v): v is number => v !== null);

  if (numericValues.length === 0) {
    return {
      type: 'min',
      value: 0,
      record_count: recordCount,
      meets_k_anonymity: meetsThreshold,
      min_k: minK,
    };
  }

  const minValue = Math.min(...numericValues);

  return {
    type: 'min',
    value: minValue,
    record_count: recordCount,
    meets_k_anonymity: meetsThreshold,
    min_k: minK,
  };
}

/**
 * Max aggregation
 * Returns maximum of numeric values
 */
export function max(
  records: MemoryRecord[],
  field?: string,
  minK: number = DEFAULT_K_ANONYMITY
): AggregationResult {
  const recordCount = records.length;
  const meetsThreshold = meetsKAnonymity(recordCount, minK);

  if (!meetsThreshold) {
    return {
      type: 'max',
      value: 0,
      record_count: recordCount,
      meets_k_anonymity: false,
      min_k: minK,
    };
  }

  const numericValues = records
    .map((r) => extractNumericValue(r, field))
    .filter((v): v is number => v !== null);

  if (numericValues.length === 0) {
    return {
      type: 'max',
      value: 0,
      record_count: recordCount,
      meets_k_anonymity: meetsThreshold,
      min_k: minK,
    };
  }

  const maxValue = Math.max(...numericValues);

  return {
    type: 'max',
    value: maxValue,
    record_count: recordCount,
    meets_k_anonymity: meetsThreshold,
    min_k: minK,
  };
}

/**
 * Distribution aggregation
 * Returns distribution of values (histogram)
 */
export function distribution(
  records: MemoryRecord[],
  field?: string,
  minK: number = DEFAULT_K_ANONYMITY
): AggregationResult {
  const recordCount = records.length;
  const meetsThreshold = meetsKAnonymity(recordCount, minK);

  if (!meetsThreshold) {
    return {
      type: 'distribution',
      value: {},
      record_count: recordCount,
      meets_k_anonymity: false,
      min_k: minK,
    };
  }

  // Count frequency of each value
  const dist: Record<string, number> = {};

  for (const record of records) {
    let key: string;

    if (field && record.content.type === 'structured') {
      const data = record.content.data as Record<string, any>;
      const value = field.split('.').reduce((obj, k) => obj?.[k], data);
      key = String(value);
    } else {
      key = String(record.content.data);
    }

    dist[key] = (dist[key] || 0) + 1;
  }

  return {
    type: 'distribution',
    value: dist,
    record_count: recordCount,
    meets_k_anonymity: meetsThreshold,
    min_k: minK,
  };
}

/**
 * Perform aggregation based on type
 */
export function aggregate(
  records: MemoryRecord[],
  type: AggregationType,
  field?: string,
  minK: number = DEFAULT_K_ANONYMITY
): AggregationResult {
  switch (type) {
    case 'count':
      return count(records, minK);
    case 'average':
      return average(records, field, minK);
    case 'sum':
      return sum(records, field, minK);
    case 'min':
      return min(records, field, minK);
    case 'max':
      return max(records, field, minK);
    case 'distribution':
      return distribution(records, field, minK);
    default:
      throw new Error(`Unknown aggregation type: ${type}`);
  }
}
