// iNaturalist API Response Types
export interface INaturalistTaxon {
  id: number;
  name: string;
  rank: string;
  common_name?: {
    name: string;
  };
  preferred_common_name?: string;
  iconic_taxon_name?: string;
  wikipedia_url?: string;
  default_photo?: {
    medium_url: string;
    attribution: string;
  };
}

export interface INaturalistResult {
  taxon: INaturalistTaxon;
  score: number;
  combined_score?: number;
}

export interface INaturalistResponse {
  results: INaturalistResult[];
  common_ancestor?: INaturalistTaxon;
}

// Our App's Identification Result
export interface IdentificationResult {
  species: {
    id: number;
    scientificName: string;
    commonName?: string;
    rank: string;
    taxonomy?: string;
    wikipediaUrl?: string;
    imageUrl?: string;
  };
  confidence: number;
  alternatives?: {
    scientificName: string;
    commonName?: string;
    confidence: number;
  }[];
}

// Request/Response Types
export interface IdentifyImageResponse {
  message: string;
  data?: IdentificationResult | any;
  available?: boolean;
}

