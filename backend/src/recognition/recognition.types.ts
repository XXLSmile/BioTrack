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

export interface RecognitionImagePayload {
  recognition: RecognitionResult;
  imagePath?: string;
  absoluteImageUrl?: string;
  latitude?: number;
  longitude?: number;
}

export interface RecognitionImageResponse {
  message: string;
  data?: RecognitionImagePayload;
}

export interface SaveRecognitionRequestBody {
  imagePath: string;
  recognition: RecognitionResult;
  catalogId?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
}
