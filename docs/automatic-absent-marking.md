# Automatic Absent Marking System

This document explains how to set up, test, and troubleshoot the automatic absent marking system in Attendify for both local development and production environments.

## System Overview

The automatic absent marking system has these components:

1. **API Endpoint**: Located at `/api/autoMarkAbsents/route.ts`
   - Checks for class sessions that have ended in the last 30 minutes
   - Marks students without attendance records as absent
   - Creates notifications for these absences

2. **Scheduling**:
   - In production: Vercel cron job (configured in `functions/vercel.json`)
   - In development: Manual triggers or simulated cron job

## Setup Instructions

### 1. Environment Variables

Create a `.env.local` file in the project root with:

```
CRON_SECRET=your_secure_secret_here
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

- `CRON_SECRET`: A secure string used to authenticate API calls
- `FIREBASE_SERVICE_ACCOUNT_JSON`: Your Firebase service account credentials (as JSON string)

### 2. Vercel Configuration

The `functions/vercel.json` file contains the cron job configuration:

```json
{
  "crons": [
    {
      "path": "/api/autoMarkAbsents",
      "schedule": "*/15 * * * *",
      "headers": {
        "Authorization": "Bearer ${CRON_SECRET}"
      }
    }
  ]
}
```

This runs every 15 minutes in production.

## Testing Locally

### Option 1: One-time Manual Trigger (PowerShell)

Run your Next.js development server:
```
npm run dev
```

Then in a separate terminal, execute:
```
.\trigger-cron.ps1
```

### Option 2: Continuous Monitoring (PowerShell)

Run your Next.js development server:
```
npm run dev
```

Then in a separate terminal, execute:
```
.\monitor-cron.ps1
```

This simulates the production cron job by triggering the endpoint every 15 minutes.

### Option 3: Node.js Scripts

For Node.js users, you can use the provided scripts:
```
npm run test-cron    # For one-time testing
npm run dev-cron     # For continuous monitoring
```

## Troubleshooting

### Common Issues

1. **API returns 401 Unauthorized**
   - Ensure `CRON_SECRET` in your `.env.local` matches the one in your API request
   - Check that the authorization header is correctly formatted: `Bearer your_secret_here`

2. **Firebase initialization errors**
   - Verify your `FIREBASE_SERVICE_ACCOUNT_JSON` is a valid JSON string
   - Check for Firebase permissions issues (Firestore access, etc.)

3. **No absences being marked**
   - Confirm there are class sessions scheduled for today
   - Check that the session end time falls within the last 30 minutes
   - Verify students exist in those classes without attendance records
   - Look for detailed logs in the API response and terminal output

### Debug Logging

The absent marking system provides detailed logs in the console. Look for lines starting with:
`[API autoMarkAbsents]`

## Testing Guidelines

To thoroughly test this feature:

1. **Create test data:**
   - Set up a classroom with a session ending soon
   - Add test students to this classroom
   - Don't create attendance records for these students

2. **Time your test:**
   - Run the trigger script within 30 minutes after the session end time

3. **Verify results:**
   - Check Firestore for new attendance records with `status: "absent"`
   - Verify notifications were created for the absent students

## Production Deployment

When deployed to Vercel, the cron job will run automatically every 15 minutes. To verify it's working:

1. Check Vercel Function Logs for executions of the `/api/autoMarkAbsents` endpoint
2. Monitor Firestore for new absence records
3. If needed, you can manually trigger the endpoint in production using tools like Postman or cURL (with the proper authorization header)

## Development Best Practices

1. Always test changes locally before deploying
2. Monitor logs closely after deployment to ensure the system is working correctly
3. Consider implementing alerts for critical errors in the absence marking process
