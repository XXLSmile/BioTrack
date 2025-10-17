import { Express } from 'express';
import { IdentificationResult } from '../identify/identify.types';

export type UploadImageRequest = {
  file: Express.Multer.File;
};

export type UploadImageResponse = {
  message: string;
  data?: {
    image: string;
    identification?: IdentificationResult;
  };
};