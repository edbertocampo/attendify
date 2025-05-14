// A simple Node.js script to test the autoMarkAbsents route.js function
// This script simulates calling the API with a time override

const http = require('http');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// Configuration
const hostname = 'localhost';
const port = 3000;
const endpoint = '/api/autoMarkAbsents';
const secretKey = process.env.CRON_SECRET;

if (!secretKey) {
  console.error('Error: CRON_SECRET not found in .env.local');
  process.exit(1);
}

// Get command line parameters
const args = process.argv.slice(2);
let timeOverride = null;
let debugMode = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--time' && i + 1 < args.length) {
    // Format: --time "2023-05-30T20:05:00.000Z"
    timeOverride = args[i + 1];
    i++; // Skip the next argument which is the time value
  } else if (args[i] === '--debug') {
    debugMode = true;
  }
}

// Determine the simulation time for the TIMING0541 classroom test
// TIMING0541 has a session on Wednesday from 19:41 to 20:01
if (!timeOverride) {
  const now = new Date();
  // Create a date for Wednesday at 20:06 (5 minutes after session end)
  const simulatedDate = new Date();
  
  // Get the current day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const currentDayOfWeek = now.getDay();
  
  // Calculate days to add to get to Wednesday (3 is Wednesday)
  // If today is Wednesday, we don't add days
  // Otherwise, we add days to get to the next Wednesday
  let daysToAdd = 0;
  if (currentDayOfWeek !== 3) { // 3 = Wednesday
    daysToAdd = (3 - currentDayOfWeek + 7) % 7;
    if (daysToAdd === 0) daysToAdd = 7; // If today is Wednesday, go to next Wednesday
  }
  
  // Add days to get to Wednesday and set time to 20:06
  simulatedDate.setDate(now.getDate() + daysToAdd);
  simulatedDate.setHours(20, 6, 0, 0);
  
  timeOverride = simulatedDate.toISOString();
  console.log(`Auto-generated time override to simulate 5 minutes after TIMING0541 session end: ${timeOverride}`);
}

console.log(`Making API request to http://${hostname}:${port}${endpoint}`);
console.log(`Authorization: Bearer ${secretKey.substring(0, 3)}...${secretKey.substring(secretKey.length - 3)}`);
console.log(`Time override: ${timeOverride || 'none'}`);
console.log(`Debug mode: ${debugMode}`);

// Make the API request
const options = {
  hostname,
  port,
  path: endpoint,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${secretKey}`,
    'Content-Type': 'application/json'
  }
};

if (timeOverride) {
  options.headers['X-Time-Override'] = timeOverride;
}

if (debugMode) {
  options.headers['X-Debug-Mode'] = 'true';
}

const req = http.request(options, (res) => {
  console.log(`Status code: ${res.statusCode}`);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const jsonResponse = JSON.parse(data);
      console.log('\nAPI Response:');
      console.log(JSON.stringify(jsonResponse, null, 2));
      
      // Summary
      if (jsonResponse.markedAbsentCount > 0) {
        console.log(`\n✅ Successfully marked ${jsonResponse.markedAbsentCount} students absent!`);
      } else {
        console.log('\n❌ No students were marked absent.');
        console.log('Check the debug information to understand why.');
      }
    } catch (e) {
      console.error('Error parsing response:', e);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();
