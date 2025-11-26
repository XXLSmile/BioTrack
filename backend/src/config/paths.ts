import fs from 'fs';
import path from 'path';

import logger from '../utils/logger.util';

// Always resolve from the project root, not dist/src
export const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads/images');

// Ensure folder exists
if (!fs.existsSync(UPLOADS_ROOT)) {
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
  logger.info('✅ Created upload directory', UPLOADS_ROOT);
}
