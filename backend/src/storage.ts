import multer from 'multer';
import path from 'path';
import { UPLOADS_ROOT } from './config/paths';

// Disk storage for file system (keeps both file and buffer available)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_ROOT);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
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
