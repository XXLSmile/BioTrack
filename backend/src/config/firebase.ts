import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

const serviceAccountPath = path.resolve(__dirname, '../firebase-adminsdk.json');

const initializeWithCredentials = (): admin.messaging.Messaging => {
  const serviceAccountRaw = fs.readFileSync(serviceAccountPath, 'utf8');
  const serviceAccount = JSON.parse(serviceAccountRaw);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  return admin.messaging();
};

const initializeWithoutCredentials = (): Pick<admin.messaging.Messaging, 'send'> => {
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID ?? 'local-dev',
    });
  }

  const noopMessaging = {
    async send() {
      if (process.env.NODE_ENV !== 'test') {
        console.warn(
          'Firebase service account not found. Messaging send() invoked in noop mode.'
        );
      }
      return '';
    },
  };

  return noopMessaging;
};

const messagingInstance = fs.existsSync(serviceAccountPath)
  ? initializeWithCredentials()
  : initializeWithoutCredentials();

export const messaging: admin.messaging.Messaging | Pick<admin.messaging.Messaging, 'send'> = messagingInstance;
export default admin;
