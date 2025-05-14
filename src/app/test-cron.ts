// A simple script to test the autoMarkAbsents API route locally
// Run this with: npx ts-node src/app/test-cron.ts

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error('Error: CRON_SECRET not found in environment variables');
  process.exit(1);
}

async function testCronJob() {
  try {
    const response = await fetch('http://localhost:3000/api/autoMarkAbsents', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`
      }
    });
    
    const result = await response.json();
    console.log('API Response:', result);
  } catch (error) {
    console.error('Error calling API:', error);
  }
}

testCronJob();
