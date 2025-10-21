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

// Our application's recognition result shape
export interface RecognitionResult {
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

// Request/response types
export interface RecognitionImageResponse {
  message: string;
  data?: RecognitionResult | any;
  available?: boolean;
}
