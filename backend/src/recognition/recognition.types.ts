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
  data?: RecognitionResult | unknown;
  available?: boolean;
}
