import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

const serviceAccountPath = path.resolve(__dirname, '../firebase-adminsdk.json');

interface MessagingAdapter {
  send(message: admin.messaging.Message, dryRun?: boolean): Promise<string>;
}

const resolveMessageTarget = (message: admin.messaging.Message): string => {
  const targetToken =
    'token' in message && typeof message.token === 'string' ? message.token : undefined;
  if (targetToken && targetToken.length > 0) {
    return targetToken;
  }

  const targetTopic =
    'topic' in message && typeof message.topic === 'string' ? message.topic : undefined;
  if (targetTopic && targetTopic.length > 0) {
    return targetTopic;
  }

  const targetCondition =
    'condition' in message && typeof message.condition === 'string'
      ? message.condition
      : undefined;
  if (targetCondition && targetCondition.length > 0) {
    return targetCondition;
  }

  const analyticsLabel = message.fcmOptions?.analyticsLabel;
  if (analyticsLabel && analyticsLabel.length > 0) {
    return analyticsLabel;
  }

  return 'unknown target';
};

const initializeWithCredentials = (): MessagingAdapter => {
  const serviceAccountRaw = fs.readFileSync(serviceAccountPath, 'utf8');
  const serviceAccount = JSON.parse(serviceAccountRaw);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  return {
    send(message: admin.messaging.Message, dryRun?: boolean) {
      const result: Promise<string> = admin.messaging().send(message, dryRun);
      return result;
    },
  };
};

const initializeWithoutCredentials = (): MessagingAdapter => {
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID ?? 'local-dev',
    });
  }

  const noopMessaging: MessagingAdapter = {
    send(message: admin.messaging.Message) {
      if (process.env.NODE_ENV !== 'test') {
        const target = resolveMessageTarget(message);
        console.warn(
          `Firebase service account not found. Messaging send() invoked in noop mode for target: ${target}.`
        );
      }
      return Promise.resolve('');
    },
  };

  return noopMessaging;
};

const messagingInstance = fs.existsSync(serviceAccountPath)
  ? initializeWithCredentials()
  : initializeWithoutCredentials();

export const messaging: MessagingAdapter = messagingInstance;
export default admin;
