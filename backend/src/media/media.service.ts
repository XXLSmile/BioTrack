import fs from 'fs';
import path from 'path';
import { UPLOADS_ROOT } from '../config/paths';

export class MediaService {

  static async saveImage(filePath: string, userId: string): Promise<string> {
    try {
      const fileExtension = path.extname(filePath);
      const fileName = `${userId}-${Date.now()}${fileExtension}`;
      const newPath = path.join(UPLOADS_ROOT, fileName);

      fs.renameSync(filePath, newPath);
      return newPath.split(path.sep).join('/');
    } catch (error) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      throw new Error(`Failed to save profile picture: ${error}`);
    }
  }

  static async deleteImage(url: string): Promise<void> {
    try {
      const filePath = path.resolve(url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (error) {
      console.error('Failed to delete old profile picture:', error);
    }
  }

  static async deleteAllUserImages(userId: string): Promise<void> {
    try {
      if (!fs.existsSync(UPLOADS_ROOT)) return;
      const files = fs.readdirSync(UPLOADS_ROOT);
      const userFiles = files.filter(file => file.startsWith(`${userId}-`));
      for (const file of userFiles) {
        const filePath = path.join(UPLOADS_ROOT, file);
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Failed to delete user images:', error);
    }
  }
}
