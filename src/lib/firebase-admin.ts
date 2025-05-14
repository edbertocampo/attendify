import * as admin from 'firebase-admin';

// Initialize Firebase Admin
function initializeFirebaseAdmin() {
  if (!admin.apps.length) {
    try {
      const serviceAccountJSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      
      if (!serviceAccountJSON) {
        console.error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is missing or empty');
        return null;
      }
      
      const serviceAccount = JSON.parse(serviceAccountJSON);
      
      const app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
      });
      
      console.log('Firebase Admin initialized successfully');
      return app;
    } catch (error) {
      console.error('Firebase Admin initialization error:', error);
      return null;
    }
  } else {
    return admin.app();
  }
}

// Get Firestore instance
export function getFirestoreAdmin() {
  const app = initializeFirebaseAdmin();
  if (!app) {
    return null;
  }
  return app.firestore();
}

export default admin;
