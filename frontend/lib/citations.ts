export interface Citation {
  index: number;
  chunk_id: string;
  source: string;
  section: string;
  page?: number;
  snippet?: string;
  verdict?: "supported" | "partial" | "unsupported" | string;
  confidence?: number;
  sentence?: string;
}

export interface Confidence {
  composite?: number;
  retrieval?: number;
  citation_coverage?: number;
  completeness?: number;
  hallucination_risk?: number;
}

export interface HallucinationInfo {
  score: number;
  unsupported_claims?: string[];
  contradictions?: string[];
  total_claims?: number;
}

