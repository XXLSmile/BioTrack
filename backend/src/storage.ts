import multer from 'multer';
import type { Request } from 'express';
import path from 'path';

import { UPLOADS_ROOT } from './config/paths';

// Disk storage for file system (keeps both file and buffer available)
const diskStorageOptions: multer.DiskStorageOptions = {
  destination: (_req: Request, _file, cb) => {
    cb(null, UPLOADS_ROOT);
  },
  filename: (_req: Request, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const extension = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${extension}`);
  },
};

const storage = multer.diskStorage(diskStorageOptions);

// Memory storage for keeping image data in buffer (used for DB storage)
const memoryStorage = multer.memoryStorage();

const fileFilter: multer.Options['fileFilter'] = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only image files are allowed!'));
};

// Export both storage options
export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadMemory = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});
