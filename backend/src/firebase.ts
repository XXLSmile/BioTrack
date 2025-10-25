import admin from "firebase-admin";
import path from "path";
import fs from "fs";

// Resolve the absolute path to your service account file
const serviceAccountPath = path.resolve(__dirname, "../biotrack-df1d8-firebase-adminsdk-fbsvc-06cd79a9d7.json");

// Read and parse the JSON key file
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Export the messaging instance
export const messaging = admin.messaging();
export default admin;
