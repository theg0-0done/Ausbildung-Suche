import { useEffect, useState } from 'react';
import type { JobSearchItem } from '../types';
import { getCachedEmails, loadEmails } from '../lib/emailIndex';

const CONCURRENCY = 3;

export interface EmailCheck {
  /** reference number -> addresses, for every offer checked so far (missing key = not checked yet) */
  found: Record<string, string[]>;
}

/**
 * Checks the descriptions of the given offers for e-mail addresses, three requests at a time.
 * The search response has no description, so each offer costs one detail request (cached).
 */
export function useEmailCheck(enabled: boolean, jobs: JobSearchItem[]): EmailCheck {
  const [found, setFound] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    const queue: string[] = [];
    const known: Record<string, string[]> = {};

    for (const job of jobs) {
      const cached = getCachedEmails(job.referenznummer);
      if (cached) known[job.referenznummer] = cached;
      else queue.push(job.referenznummer);
    }

    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setFound((prev) => ({ ...prev, ...known }));
    });

    const worker = async () => {
      for (;;) {
        const refnr = queue.shift();
        if (refnr === undefined || controller.signal.aborted) return;
        try {
          const emails = await loadEmails(refnr, controller.signal);
          if (controller.signal.aborted) return;
          setFound((prev) => ({ ...prev, [refnr]: emails }));
        } catch {
          return; // aborted
        }
      }
    };

    for (let i = 0; i < CONCURRENCY; i += 1) void worker();

    return () => controller.abort();
  }, [enabled, jobs]);

  return { found };
}
