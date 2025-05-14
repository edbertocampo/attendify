# Production Environment Scheduler Guide

## Introduction
In a production environment, you need a reliable way to trigger the auto-attendance system on a regular schedule.
This guide provides options based on your hosting environment.

## Option 1: Vercel Cron Jobs (Recommended for Next.js apps on Vercel)

If your application is hosted on Vercel, you can use Vercel's built-in Cron Jobs feature.

### Setup in vercel.json:

```json
{
  "crons": [
    {
      "path": "/api/autoMarkAbsents",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

This configuration will call your API endpoint every 15 minutes.

### Security:
Update your API route to accept requests from Vercel Cron:

```typescript
// in src/app/api/autoMarkAbsents/route.ts
// Check for Vercel Cron in addition to your CRON_SECRET
const isVercelCron = request.headers.get('x-vercel-cron') === 'true';
if (!(authHeader === `Bearer ${process.env.CRON_SECRET}` || isVercelCron)) {
  console.warn('[API autoMarkAbsents] Unauthorized attempt');
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

## Option 2: Cloud Scheduler (Google Cloud, Azure, AWS)

### Google Cloud Scheduler:
1. Create a Cloud Scheduler job
2. Set the frequency to "*/15 * * * *" (every 15 minutes)
3. Set the target to HTTP
4. Enter your API endpoint URL
5. Add an Authorization header with your CRON_SECRET

### Azure Scheduler:
1. Create a Logic App with a recurrence trigger
2. Set it to run every 15 minutes
3. Add an HTTP action to call your API endpoint
4. Include the Authorization header

### AWS EventBridge:
1. Create a rule with a schedule of "rate(15 minutes)"
2. Set the target to an AWS Lambda function
3. Create a Lambda that makes an HTTP request to your API endpoint
4. Include the Authorization header

## Option 3: Traditional Cron (Linux/Unix servers)

If you're hosting on a traditional server:

1. Create a shell script to call your API:

```bash
#!/bin/bash
# File: trigger-attendance.sh

# Call the API endpoint
curl -X GET "https://your-app-domain.com/api/autoMarkAbsents" \
  -H "Authorization: Bearer your-cron-secret"
```

2. Make it executable: `chmod +x trigger-attendance.sh`

3. Add a cron job:
```
*/15 * * * * /path/to/trigger-attendance.sh
```

## Option 4: Windows Scheduled Task (Windows servers)

Use the PowerShell script provided in the repository:

```powershell
# Run as administrator
.\setup-auto-attendance-scheduler.ps1
```

This will create a Windows Scheduled Task that runs every 15 minutes.

## Monitoring

Regardless of the method chosen, set up monitoring to ensure your cron job is running properly:

1. Add detailed logging to your API endpoint
2. Set up alerts for any failures
3. Track the number of students marked absent/late over time to ensure the system is working

## Testing

Before deploying to production, test your selected scheduling method thoroughly:

1. Start with a higher frequency (e.g., every 2 minutes)
2. Monitor the logs to ensure it's being triggered
3. Once verified, adjust to the desired frequency (e.g., every 15 minutes)
