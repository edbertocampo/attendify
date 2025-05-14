# Auto-Attendance Marking System Documentation

## Overview

The auto-attendance marking system in Attendify automatically marks students as absent or late when they fail to submit attendance within specified timeframes. The system processes all non-archived classrooms on a regular basis through a cron job.

## How It Works

1. The system is triggered by an API endpoint (`/api/autoMarkAbsents`) that's called by a scheduled task
2. It processes all non-archived classrooms in the Firestore database
3. For each classroom, it checks all sessions and identifies those scheduled for today
4. It then applies the following logic:

### Timing Rules

![Attendance Timing Diagram](./docs/attendance-timing-diagram.png)

- **Grace Period**: First 15 minutes after class start time
- **Late Marking Window**: From the end of the grace period until the class end time
- **Absent Marking Window**: From class end time until 30 minutes after class end

### Data Format Handling

The system robustly handles various data formats:

1. **Time Formats**:
   - 24-hour format (e.g., "14:30")
   - 12-hour format with AM/PM (e.g., "2:30 pm")

2. **Day Formats**:
   - Case-insensitive (e.g., "monday", "Monday", "MONDAY")
   - Properly capitalized (e.g., "Monday")

3. **Session Subjects**:
   - Sessions can have optional subjects
   - When a subject is specified, attendance is only checked for that specific subject

## API Details

### Endpoint

```
GET /api/autoMarkAbsents
```

### Headers

```
Authorization: Bearer <CRON_SECRET>
```

### Response

```json
{
  "success": true,
  "checkedSessions": 5,
  "markedAbsentCount": 0,
  "markedLateCount": 1
}
```

## Testing the System

Use the following scripts to test the system:

1. `check-classrooms.ps1`: Check the structure of all classrooms in the system
2. `check-all-classrooms.ps1`: Specifically look for classrooms with sessions on the current day
3. `update-existing-classroom.ps1`: Add test sessions to an existing classroom
4. `run-full-attendance-test.ps1`: Comprehensive test that creates a session and marks attendance
5. `simple-trigger.ps1`: Directly trigger the auto-attendance API

## Debugging

If you encounter issues:

1. Check that classroom session days match the current day of the week
2. Verify that session times are properly formatted
3. Ensure session end times are within the 30-minute window for marking absences
4. Confirm that students exist in the classroom
5. Review server logs for any errors during processing

## Limitations and Considerations

1. The system only marks students as absent/late if:
   - They're enrolled in the classroom
   - They haven't submitted attendance for the day (and specific subject if applicable)
   - The session timing conditions are met

2. The system processes each classroom and session independently, so it's scalable to any number of classrooms

3. Attendance records include subject information when available, correctly grouping attendance by subject

## Future Enhancements

Consider implementing:

1. A configuration UI for attendance rules (grace period, absent window)
2. Customizable notification templates
3. A dashboard to monitor the system's performance
4. The ability to exclude certain days (like holidays) from automatic absent marking
