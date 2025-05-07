import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';

console.log('[MongoDB] Connecting with URI:', MONGODB_URI ? MONGODB_URI.slice(0, 30) + '...' : 'undefined');

if (!MONGODB_URI) {
  console.error('[MongoDB] MONGODB_URI is not defined!');
  throw new Error('Please define the MONGODB_URI environment variable');
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  if (!(global as any)._mongoClientPromise) {
    client = new MongoClient(MONGODB_URI);
    (global as any)._mongoClientPromise = client.connect().then((c) => {
      console.log('[MongoDB] Connected (dev)');
      return c;
    }).catch((err) => {
      console.error('[MongoDB] Connection error (dev):', err);
      throw err;
    });
  }
  clientPromise = (global as any)._mongoClientPromise;
} else {
  client = new MongoClient(MONGODB_URI);
  clientPromise = client.connect().then((c) => {
    console.log('[MongoDB] Connected (prod)');
    return c;
  }).catch((err) => {
    console.error('[MongoDB] Connection error (prod):', err);
    throw err;
  });
}

export default clientPromise;