import { z } from 'zod';
import type { JobSearchItem, SearchResponse } from './types';

const facetSchema = z
  .object({
    counts: z.record(z.string(), z.number()),
    maxCount: z.number().optional(),
  })
  .passthrough();

const woOutputSchema = z
  .object({
    bereinigterOrt: z.string().optional(),
    suchmodus: z.string().optional(),
    koordinaten: z.array(z.object({ lat: z.number(), lon: z.number() })).optional(),
  })
  .passthrough();

/** Items stay loosely typed (the API adds fields often) but must carry a reference number. */
const jobItemSchema = z.custom<JobSearchItem>(
  (v) =>
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { referenznummer?: unknown }).referenznummer === 'string'
);

export const searchResponseSchema = z
  .object({
    ergebnisliste: z.array(jobItemSchema).default([]),
    maxErgebnisse: z.coerce.number().default(0),
    page: z.coerce.number().default(1),
    size: z.coerce.number().default(0),
    facetten: z.record(z.string(), facetSchema).optional(),
    woOutput: woOutputSchema.optional(),
  })
  .passthrough();

export function parseSearchResponse(raw: unknown): SearchResponse {
  return searchResponseSchema.parse(raw) as SearchResponse;
}
