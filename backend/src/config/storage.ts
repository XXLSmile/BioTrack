import multer from 'multer';
import path from 'path';
import { randomBytes } from 'crypto';
import { UPLOADS_ROOT } from './paths';

// Disk storage for file system (keeps both file and buffer available)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_ROOT);
  },
  filename: (req, file, cb) => {
    const originalName: string =
      typeof file.originalname === 'string' && file.originalname.length > 0
        ? file.originalname
        : 'upload';
    const extension = path.extname(originalName).toLowerCase();
    const secureName = `${randomBytes(16).toString('hex')}${extension}`;
    cb(null, secureName);
  },
});

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
