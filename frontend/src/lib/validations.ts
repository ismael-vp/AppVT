import { z } from "zod";

// --- Sub-esquemas ---

export const EngineResultSchema = z.object({
  name: z.string(),
  status: z.string(),
  result: z.string().nullable(),
  method: z.string(),
});

export const ThreatStatsSchema = z.object({
  malicious: z.number(),
  suspicious: z.number(),
  undetected: z.number(),
  harmless: z.number(),
  timeout: z.number(),
  full_results: z.array(EngineResultSchema).optional(),
  heuristic_flag: z.string().optional(),
});

export const AISummarySchema = z.union([
  z.string(),
  z.object({
    summary: z.string(),
    action_steps: z.array(z.string()),
  }),
]).nullable();

export const GeolocationSchema = z.object({
  ip: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  country: z.string().optional(),
  countryCode: z.string().optional(),
  city: z.string().optional(),
  isp: z.string().optional(),
}).nullable();

export const OSINTDataSchema = z.object({
  geolocation: GeolocationSchema.nullish(),
  whois: z.object({
    registrar: z.string().nullish(),
    creation_date: z.string().nullish(),
    expiration_date: z.string().nullish(),
  }).nullish(),
  ssl: z.object({
    issuer: z.string().nullish(),
    expiration_date: z.string().nullish(),
    is_suspicious: z.boolean().nullish(),
  }).nullish(),
  dns: z.object({
    spamhaus_listed: z.boolean().default(false),
    surbl_listed: z.boolean().default(false),
    blacklist_details: z.array(z.string()).default([]),
    has_mx: z.boolean().default(false),
  }).nullish(),
  is_typosquatting: z.boolean().nullish(),
  target_brand: z.string().nullish(),
  has_dangerous_form: z.boolean().nullish(),
  redirect_chain: z.array(z.string()).nullish(),
  external_scripts: z.array(z.string()).nullish(),
  technologies: z.array(z.string()).nullish(),
  cloaking_detected: z.boolean().nullish(),
  screenshot_desktop: z.string().nullish(),
  screenshot_mobile: z.string().nullish(),
  // Detección híbrida
  safe_browsing_threat: z.boolean().default(false),
  safe_browsing_types: z.array(z.string()).default([]),
  safe_browsing_checked: z.boolean().default(false),
  feed_detected: z.boolean().default(false),
  feed_source: z.string().nullish(),
  // Heurística
  heuristic_result: z.object({
    risk_score: z.number(),
    level: z.string(),
    flags: z.array(z.string()),
  }).nullish(),
  abuseConfidenceScore: z.number().nullish(),
  totalReports: z.number().nullish(),
  privacy_analysis: z.object({
    tracking_used: z.array(z.string()).default([]),
    trackers_count: z.number().default(0),
    data_linked: z.array(z.string()).default([]),
    device_access: z.array(z.string()).default([]),
  }).nullish(),
}).passthrough(); // passthrough() reenvía campos desconocidos en lugar de descartarlos (strip)
// Esto garantiza que nuevos campos del backend sean visibles en el frontend sin romper la validación

// H-8 / M-12: Schema tipado para image_analysis en lugar de z.any()
export const ImageAnalysisSchema = z.object({
  is_phishing: z.boolean(),
  confidence: z.string(),
  verdict: z.string(),
  red_flags: z.array(z.string()).default([]),
  extracted_text: z.string().nullish(),
  extracted_urls: z.array(z.string()).default([]),
}).nullable().optional();

// --- Esquema Principal ---

export const ScanResultSchema = z.object({
  type: z.enum(["url", "image"]),
  stats: ThreatStatsSchema.nullable().optional(),
  ai_summary: AISummarySchema.optional(),
  status: z.enum(["success", "error"]),
  message: z.string().optional(),
  resourceName: z.string().optional(),
  timestamp: z.string().optional(),
  osint_data: OSINTDataSchema.nullable().optional(),
  image_analysis: ImageAnalysisSchema,
});

export type ScanResultValidated = z.infer<typeof ScanResultSchema>;
