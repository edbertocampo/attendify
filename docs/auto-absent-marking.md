# Automatic Absent Marking Guide

This document explains how to use and test the automatic absent marking feature in both local development and production environments.

## Overview

The Attendify application includes an automatic absent marking feature that runs as a scheduled task. This feature:

1. Checks for class sessions that ended within the last 30 minutes
2. For each session, marks students without an attendance record as absent
3. Creates notifications for these automatically marked absences

## Production Environment (Vercel)

In production, this feature runs automatically as a Vercel cron job:

- Configured in `functions/vercel.json`
- Runs every 15 minutes
- Uses authentication with the `CRON_SECRET` environment variable
- No manual action required once deployed

## Local Development Environment

Vercel cron jobs do not run in local development. Here are two options to test this feature locally:

### Option 1: Manual Testing (Quick)

To manually trigger the auto-mark-absents API endpoint:

1. **Run your Next.js development server**:
   ```
   npm run dev
   ```

2. **Execute the test script**:
   ```
   npm run test-cron
   ```

This script will make a single call to the API endpoint with the proper authentication headers.

### Option 2: Simulated Cron Job (Continuous Testing)

For continuous testing during development:

1. **Run your Next.js development server in one terminal**:
   ```
   npm run dev
   ```

2. **Run the dev-cron script in another terminal**:
   ```
   npm run dev-cron
   ```

This will run a Node.js process that simulates the Vercel cron job, triggering the API endpoint every 15 minutes.

## Environment Setup

Ensure your `.env.local` file includes:

```
CRON_SECRET=your_secret_here
FIREBASE_SERVICE_ACCOUNT_JSON=your_service_account_json_here
```

## Troubleshooting

1. **Authentication Errors**: Ensure your `CRON_SECRET` in `.env.local` matches the one used in your API request.

2. **Firebase Initialization Errors**: Check that your Firebase service account JSON is correctly formatted and complete.

3. **No Absences Being Marked**: Verify that:
   - There are classes scheduled for today
   - The class session end time falls within the past 30 minutes
   - Students exist in those classes without attendance records

## Testing Guide

To thoroughly test absent marking:

1. Create a test classroom with a session ending soon
2. Add test students to this classroom
3. Wait for the session to end (according to the schedule)
4. Run the test script or wait for the simulated cron job
5. Check the Firebase console for new absence records and notifications

## Logs

For local development, check your terminal for logs about the process.

In production, access Vercel logs from your project dashboard.
