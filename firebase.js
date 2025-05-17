const admin = require('firebase-admin');

const base64Key = process.env.FIREBASE_CONFIG_BASE64;

if (!base64Key) {
  throw new Error("FIREBASE_CONFIG_BASE64 env variable is missing.");
}

const decodedKey = Buffer.from(base64Key, 'base64').toString('utf-8');
const serviceAccount = JSON.parse(decodedKey);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://<your-project-id>.firebaseio.com' // Replace with your DB URL
});

const db = admin.firestore();

module.exports = db;
