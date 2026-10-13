// ---- Search API response types (/v6/jobs) ----

export interface JobFilters {
  was?: string;
  wo?: string;
  umkreis?: string;
  /** Days; several values are allowed but the API only needs the largest (ranges are nested) */
  veroeffentlichtseit?: string[];
  arbeitszeit?: string[];
  angebotsart?: string;
  befristung?: string;
  berufsfeld?: string[];
  beruf?: string[];
  arbeitgeber?: string;
  /** 'false' hides temp-agency listings */
  zeitarbeit?: string;
  pav?: string;
  /** 'true' = only listings suitable for people with disabilities */
  behinderung?: string;
  /** 1 ohne Abschluss … 5 Abitur: listings open to someone with that school level */
  schulbildung?: string;
  /** Start month range as returned by the facets, e.g. 26_10_01-26_11_01 */
  eintrittsdatum?: string[];
  /** 'false' hides listings that come from other job boards */
  externestellenboersen?: string;
  /**
   * Client-side only (the API cannot filter by pay): minimum first-year pay in €.
   * Presence of the key switches the filter on; '0' means "any pay stated".
   */
  minVerguetung?: string;
  /** Client-side only: 'true' keeps offers whose description contains an e-mail address. */
  mitEmail?: string;
  /** Server-side for angebotsart=4: 0 Ausbildung, 1 ausbildungsintegrierend, 2 praxisintegrierend */
  ausbildungsart?: string;
}

export interface Facet {
  counts: Record<string, number>;
  maxCount?: number;
}

export type Facets = Record<string, Facet | undefined>;

export interface WoOutput {
  bereinigterOrt?: string;
  suchmodus?: string;
  koordinaten?: { lat: number; lon: number }[];
}

/** One search hit from /pc/v6/jobs. Same shape as the detail payload, minus the long description. */
export interface JobSearchItem {
  stellenangebotsart?: string;
  ausbildungsart?: string;
  studienform?: string;
  studiengang?: string;
  stellenangebotsTitel?: string;
  hauptberuf?: string;
  firma?: string;
  arbeitgeberKundennummerHash?: string;
  referenznummer: string;
  stellenlokationen?: Stellenlokation[];
  eintrittszeitraum?: Eintrittszeitraum;
  entfernung?: number;
  alleBerufe?: string[];
  ausbildungsverguetungJahr1?: number;
  ausbildungsverguetungJahr2?: number;
  ausbildungsverguetungJahr3?: number;
  ausbildungsverguetungJahr4?: number;
  festgehalt?: number;
  gehaltsspanneVon?: number;
  gehaltsspanneBis?: number;
  [key: string]: unknown;
}

export interface SearchResponse {
  ergebnisliste: JobSearchItem[];
  maxErgebnisse: number;
  page: number;
  size: number;
  facetten?: Facets;
  woOutput?: WoOutput;
}

// ---- Detail API response types (/v4/jobdetails) ----

export interface DetailAdresse {
  strasse?: string;
  hausnummer?: string;
  plz?: string;
  ort?: string;
  region?: string;
  land?: string;
}

export interface Stellenlokation {
  adresse?: DetailAdresse;
  breite?: number;
  laenge?: number;
}

export interface Eintrittszeitraum {
  von?: string;
  bis?: string;
}

export interface Veroeffentlichungszeitraum {
  von?: string;
  bis?: string;
}

/**
 * Full job detail returned by /pc/v4/jobdetails/{base64(refnr)}.
 * Uses an index signature so unknown/new fields are never lost.
 */
export interface JobDetail {
  // Core
  stellenangebotsart?: string;
  ausbildungsart?: string;
  stellenangebotsTitel?: string;
  stellenangebotsBeschreibung?: string;   // Markdown!
  hauptberuf?: string;
  referenznummer?: string;

  // Employer
  firma?: string;
  arbeitgeberKundennummerHash?: string;
  allianzpartnerUrl?: string;
  allianzpartnerName?: string;

  // Locations
  stellenlokationen?: Stellenlokation[];

  // Education & Skills
  geforderterBildungsabschluss?: string;

  // Dates
  eintrittszeitraum?: Eintrittszeitraum;
  veroeffentlichungszeitraum?: Veroeffentlichungszeitraum;
  datumErsteVeroeffentlichung?: string;
  aenderungsdatum?: string;

  // Working conditions
  arbeitszeitVollzeit?: boolean;
  arbeitszeitTeilzeitVormittag?: boolean;
  arbeitszeitTeilzeitNachmittag?: boolean;
  arbeitszeitTeilzeitAbend?: boolean;
  arbeitszeitTeilzeitFlexibel?: boolean;
  arbeitszeitHeimarbeitTelearbeit?: boolean;
  arbeitszeitSchichtNachtWochenende?: boolean;

  // Compensation
  verguetungsangabe?: string;
  ausbildungsverguetungJahr1?: number;
  ausbildungsverguetungJahr2?: number;
  ausbildungsverguetungJahr3?: number;
  ausbildungsverguetungJahr4?: number;

  // Contract
  vertragsdauer?: string;

  // Flags
  istGeringfuegigeBeschaeftigung?: boolean;
  istBehinderungGefordert?: boolean;
  istBetreut?: boolean;

  // Catch-all for unknown fields
  [key: string]: unknown;
}
