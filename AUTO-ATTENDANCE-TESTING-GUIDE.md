# Testing the Attendify Auto-Attendance System

This guide will walk you through testing the automatic absent marking system to verify that it correctly processes both your test classrooms and existing classrooms in production.

## Prerequisites

Before running any tests, make sure:

1. Your Next.js development server is running on port 3001:
   ```
   npm run dev -- -p 3001
   ```

2. Your `.env.local` file contains all the necessary environment variables:
   - `CRON_SECRET` for API authentication
   - `FIREBASE_SERVICE_ACCOUNT_JSON` for Firestore access

## Testing Procedure

### Step 1: Check Current Classroom Structure

First, examine your current classrooms to understand their structure:

```powershell
.\check-classrooms.ps1
```

This will show you all classrooms, their sessions, and which ones might be processed today.

### Step 2: Add a Test Session to an Existing Classroom

To test with a real classroom, use:

```powershell
.\update-existing-classroom.ps1
```

When prompted, enter the ID of the classroom you want to test with. The script will:
- Create a session for today (current day of week)
- Set the end time 5 minutes from now
- Set the subject name to "Test Session"

### Step 3: Trigger the Auto-Attendance System

After waiting for the test session to end (about 5-6 minutes from creation), trigger the automatic attendance marking:

```powershell
.\simple-trigger.ps1
```

### Step 4: Verify Results

1. Check the API response to confirm:
   - How many sessions were checked
   - How many students were marked absent or late

2. Login to the Attendify web interface to verify:
   - Students in the test classroom have been marked absent
   - The correct subject was included in the attendance record
   - Notifications were created for the students

## Understanding the Time Logic

The system has two key time windows:

1. **Late marking**: 15 minutes after session start time until the session end time
2. **Absent marking**: Session end time until 30 minutes after the session end time

```
|---------|-------------------------|---------------------------|
  Session    Late marking period      Absent marking period
   Start    (after 15-min grace)     (up to 30-min after end)
```

## Debugging Common Issues

If you encounter issues:

1. **Time format problems**: The system now normalizes both 12-hour and 24-hour formats
   - Examples: "1:00 pm", "13:00" are both supported

2. **Day format issues**: The system now normalizes day names
   - Examples: "monday", "Monday", "MONDAY" all work

3. **Missing subjects**: The system properly includes the session subject in attendance records

4. **Firestore errors**: Check the API logs for detailed error messages

## Monitoring Production

After deploying to production:

1. Set up a cron job to trigger the API at regular intervals (e.g., every 15 minutes)
2. Forward any error logs to your monitoring system
3. Consider setting up alerts for failed API calls

## Future Enhancements

Consider implementing:

1. A configuration UI for attendance rules (grace period, absent window)
2. More detailed logging and analytics
3. Custom notifications templates for absent/late marking
