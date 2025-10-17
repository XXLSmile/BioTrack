import fs from 'fs';
import path from 'path';

// Always resolve from the project root, not dist/src
export const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads/images');

// Ensure folder exists
if (!fs.existsSync(UPLOADS_ROOT)) {
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
  console.log('✅ Created upload directory:', UPLOADS_ROOT);
}
