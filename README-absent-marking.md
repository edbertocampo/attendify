# Automatic Absent Marking System

This feature automatically marks students as absent if they don't have an attendance record for a class session that ended recently.

## Files and Components

- **API Endpoint**: `/src/app/api/autoMarkAbsents/route.ts` - Handles the logic for marking absences
- **Vercel Configuration**: `functions/vercel.json` - Configures the cron job schedule in production
- **Local Testing Tools**:
  - `trigger-cron.ps1` - PowerShell script to manually trigger the API once
  - `monitor-cron.ps1` - PowerShell script to simulate the cron job locally
  - `src/app/test-cron.ts` - Node.js script to test the endpoint once
  - `src/app/dev-cron.ts` - Node.js script to simulate the cron job continuously
  - `create-test-data.ps1` - Script to create test data for testing

## Local Development Setup

1. Create a `.env.local` file with:
   ```
   CRON_SECRET=your_secret_here
   FIREBASE_SERVICE_ACCOUNT_JSON=your_service_account_json_here
   ```

2. Start your development server:
   ```
   npm run dev
   ```

3. Choose one of these testing options:

   **PowerShell:**
   ```
   # One-time trigger
   .\trigger-cron.ps1
   
   # Continuous monitoring (every 15 minutes)
   .\monitor-cron.ps1
   ```

   **Node.js:**
   ```
   # One-time trigger
   npm run test-cron
   
   # Continuous monitoring
   npm run dev-cron
   ```

4. To create test data:
   ```
   .\create-test-data.ps1
   ```

## Detailed Documentation

For complete documentation, see:
- [Automatic Absent Marking Documentation](./docs/automatic-absent-marking.md)
