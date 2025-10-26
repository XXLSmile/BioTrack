import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// Resolve the absolute path to your service account file
const serviceAccountPath = path.resolve(__dirname, "../firebase-adminsdk.json");

const resolveServiceAccount = () => {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const candidatePaths = [
    fromEnv,
    path.resolve(__dirname, '../biotrack-df1d8-firebase-adminsdk-fbsvc-06cd79a9d7.json'),
  ].filter(Boolean) as string[];

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        const contents = fs.readFileSync(candidate, 'utf8');
        return JSON.parse(contents);
      }
    } catch (error) {
      logger.warn('Failed to read Firebase service account file', {
        path: candidate,
        error,
      });
    }
  }

  const envJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (envJson) {
    try {
      return JSON.parse(envJson);
    } catch (error) {
      logger.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON', { error });
    }
  }

  return null;
};

const serviceAccount = resolveServiceAccount();

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
  logger.info('Firebase Admin initialized with service account credentials');
} else {
  logger.warn('Firebase Admin not initialized: service account credentials not provided');
}

export const messaging = serviceAccount ? admin.messaging() : {
  async send() {
    logger.warn('Firebase messaging unavailable. Provide service account credentials to enable push notifications.');
    return { messageId: '' };
  },
} as unknown as admin.messaging.Messaging;

export default admin;
