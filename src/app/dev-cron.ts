// Local development cron simulation
// Run this as a separate process during development: npx tsx src/app/dev-cron.ts

import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { schedule } from 'node-cron';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const CRON_SECRET = process.env.CRON_SECRET;
const LOCAL_DEV_URL = 'http://localhost:3000';

if (!CRON_SECRET) {
  console.error('Error: CRON_SECRET not found in environment variables');
  process.exit(1);
}

// Function to call the API endpoint
async function callAutoMarkAbsents() {
  try {
    console.log(`[${new Date().toISOString()}] Running auto mark absents cron job...`);
    
    const response = await fetch(`${LOCAL_DEV_URL}/api/autoMarkAbsents`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`
      }
    });
    
    const result = await response.json();
    console.log(`[${new Date().toISOString()}] API Response:`, result);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error calling API:`, error);
  }
}

// Schedule the job to run every 15 minutes (same as Vercel configuration)
schedule('*/15 * * * *', callAutoMarkAbsents);

console.log(`[${new Date().toISOString()}] Local development cron simulation started.`);
console.log('Auto mark absents job will run every 15 minutes.');
console.log('Press Ctrl+C to stop.');

// Run once on startup
callAutoMarkAbsents();
