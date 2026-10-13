import type { JobSearchItem } from '../types';

export const PAY_SLIDER_MAX = 2000;
export const PAY_SLIDER_STEP = 50;

/** First-year training pay in €/month; falls back to the first later year that is stated. */
export function firstYearPay(job: JobSearchItem): number | undefined {
  const years = [
    job.ausbildungsverguetungJahr1,
    job.ausbildungsverguetungJahr2,
    job.ausbildungsverguetungJahr3,
    job.ausbildungsverguetungJahr4,
  ];
  return years.find((v): v is number => typeof v === 'number' && v > 0);
}

/** True when the offer states a pay of at least `minEuro` (0 = any stated pay). */
export function matchesMinPay(job: JobSearchItem, minEuro: number): boolean {
  const pay = firstYearPay(job);
  return pay !== undefined && pay >= minEuro;
}
