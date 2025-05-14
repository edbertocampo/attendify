# Debug Script for Auto Attendance System
# This script helps diagnose issues with the auto attendance system

# Load environment variables from .env.local
$envFile = Join-Path $PSScriptRoot ".env.local"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#].*?)=(.*)') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Remove any quotes from the value
            $value = $value -replace '^"(.*)"$', '$1'
            $value = $value -replace "^'(.*)'$", '$1'
            Set-Item -Path "env:$key" -Value $value
        }
    }
    Write-Host "Loaded environment variables from .env.local" -ForegroundColor Green
}
else {
    Write-Host "Warning: .env.local file not found." -ForegroundColor Yellow
}

$CRON_SECRET = $env:CRON_SECRET
if (-not $CRON_SECRET) {
    Write-Host "Error: CRON_SECRET not found in environment variables" -ForegroundColor Red
    exit 1
}

Write-Host "=== ATTENDIFY DEBUG SCRIPT ===" -ForegroundColor Cyan
Write-Host "This script will help diagnose issues with the auto attendance system" -ForegroundColor Yellow

# Step 1: Check time
$now = Get-Date
$daysOfWeek = @("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")
$todayDay = $daysOfWeek[$now.DayOfWeek.value__]

Write-Host "`n== TIME INFORMATION ==" -ForegroundColor Blue
Write-Host "Current Time: $now" -ForegroundColor White
Write-Host "Day of Week: $todayDay" -ForegroundColor White

# Step 2: Create a debug script to validate the session timing logic
@'
// Debug Script for Auto Attendance System
const admin = require('firebase-admin');

// Initialize Firebase Admin
try {
    const serviceAccountJSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJSON) {
        console.error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is missing');
        process.exit(1);
    }
    
    const serviceAccount = JSON.parse(serviceAccountJSON);
    
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    
    console.log('Firebase Admin initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
    process.exit(1);
}

const db = admin.firestore();
const classroomId = process.argv[2] || '4emnQYv9NjIuyBKNQXC9'; // Default to the classroom we're testing

// From route.ts: Function to normalize time formats
function normalizeTimeFormat(timeStr) {
  if (!timeStr) return null;
  
  // If already in 24-hour format (like "14:30"), return as is
  if (/^[0-2]?[0-9]:[0-5][0-9]$/.test(timeStr)) {
    return timeStr;
  }
  
  try {
    // Handle formats like "2:30 pm"
    timeStr = timeStr.toLowerCase();
    let [time, meridiem] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    
    if (meridiem === 'pm' && hours < 12) {
      hours += 12;
    } else if (meridiem === 'am' && hours === 12) {
      hours = 0;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  } catch (error) {
    console.error(`Error normalizing time format: ${timeStr}`, error);
    return null;
  }
}

async function debugAttendanceSystem() {
    try {
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
        const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const todayDay = daysOfWeek[now.getDay()];
        
        console.log("\n=== SYSTEM TIME ===");
        console.log(`Current Time: ${now.toISOString()} (${todayDay})`);
        console.log(`Formatted Date: ${todayStr}`);
        console.log(`Local Time: ${now.toLocaleTimeString()}`);
        
        // Get the classroom data
        const classroomRef = db.collection('classrooms').doc(classroomId);
        const classroomDoc = await classroomRef.get();
        
        if (!classroomDoc.exists) {
            console.error(`Classroom with ID ${classroomId} does not exist.`);
            process.exit(1);
        }
        
        const classroom = classroomDoc.data();
        console.log(`\n=== CLASSROOM DATA ===`);
        console.log(`Classroom: ${classroom.name || classroomId}`);
        console.log(`Archived: ${classroom.archived === true ? 'Yes' : 'No'}`);
        
        // Check sessions
        const sessions = Array.isArray(classroom.sessions) ? classroom.sessions : [];
        console.log(`\n=== SESSIONS (${sessions.length} total) ===`);
        console.log(`Looking for sessions on: ${todayDay}`);
        
        let validSessionsForToday = 0;
        
        for (let i = 0; i < sessions.length; i++) {
            const session = sessions[i];
            console.log(`\n-- Session ${i + 1} --`);
            
            // Check day
            const rawDay = session.day || 'undefined';
            console.log(`Raw day value: "${rawDay}"`);
            
            // Normalize the day value
            const normalizedDay = rawDay.charAt(0).toUpperCase() + rawDay.slice(1).toLowerCase();
            console.log(`Normalized day: "${normalizedDay}" (should match: "${todayDay}")`);
            
            const dayMatches = normalizedDay === todayDay;
            console.log(`Day matches today: ${dayMatches ? 'YES' : 'NO'}`);
            
            if (!dayMatches) continue;
            
            // Check times
            console.log(`\nChecking times for this ${todayDay} session:`);
            
            // Get raw time values
            const rawStartTime = session.startTime || 'undefined';
            const rawEndTime = session.endTime || 'undefined';
            console.log(`Raw start time: "${rawStartTime}"`);
            console.log(`Raw end time: "${rawEndTime}"`);
            
            // Normalize time values
            const normalizedStartTime = normalizeTimeFormat(rawStartTime);
            const normalizedEndTime = normalizeTimeFormat(rawEndTime);
            console.log(`Normalized start time: "${normalizedStartTime}"`);
            console.log(`Normalized end time: "${normalizedEndTime}"`);
            
            if (!normalizedEndTime) {
                console.log(`ERROR: Could not normalize end time "${rawEndTime}"`);
                continue;
            }
            
            // Parse times
            let [startHour, startMinute] = [0, 0];
            if (normalizedStartTime) {
                [startHour, startMinute] = normalizedStartTime.split(":").map(Number);
            }
            
            const [endHour, endMinute] = normalizedEndTime.split(":").map(Number);
            
            // Create date objects
            const sessionStart = new Date(now);
            sessionStart.setHours(startHour, startMinute, 0, 0);
            
            const sessionEnd = new Date(now);
            sessionEnd.setHours(endHour, endMinute, 0, 0);
            
            // Calculate grace period
            const gracePeriodEnd = new Date(sessionStart.getTime() + 15 * 60 * 1000);
            
            console.log(`Session start: ${sessionStart.toLocaleTimeString()}`);
            console.log(`Grace period end: ${gracePeriodEnd.toLocaleTimeString()}`);
            console.log(`Session end: ${sessionEnd.toLocaleTimeString()}`);
            
            // Calculate time differences
            const timeDiffFromEnd = now.getTime() - sessionEnd.getTime();
            const timeDiffFromGracePeriod = now.getTime() - gracePeriodEnd.getTime();
            const thirtyMinutesInMillis = 30 * 60 * 1000;
            
            console.log(`Minutes since end: ${Math.round(timeDiffFromEnd / 60000)}`);
            console.log(`Minutes since grace period: ${Math.round(timeDiffFromGracePeriod / 60000)}`);
            
            // Check conditions
            const isAfterClassEnded = now > sessionEnd && timeDiffFromEnd < thirtyMinutesInMillis && timeDiffFromEnd >= 0;
            const isAfterGracePeriod = now > gracePeriodEnd && now <= sessionEnd;
            
            console.log(`\nCondition Results:`);
            console.log(`- now > sessionEnd: ${now > sessionEnd}`);
            console.log(`- timeDiffFromEnd < 30 min: ${timeDiffFromEnd < thirtyMinutesInMillis}`);
            console.log(`- timeDiffFromEnd >= 0: ${timeDiffFromEnd >= 0}`);
            console.log(`- now > gracePeriodEnd: ${now > gracePeriodEnd}`);
            console.log(`- now <= sessionEnd: ${now <= sessionEnd}`);
            
            console.log(`\nFinal Status:`);
            console.log(`Should mark ABSENT: ${isAfterClassEnded}`);
            console.log(`Should mark LATE: ${isAfterGracePeriod}`);
            
            // Check if the session should be processed
            if (isAfterClassEnded || isAfterGracePeriod) {
                validSessionsForToday++;
                console.log(`\n*** THIS SESSION SHOULD BE PROCESSED NOW ***`);
                console.log(`Processing type: ${isAfterClassEnded ? 'ABSENT' : 'LATE'}`);
                
                // Check subject
                const subject = session.subject || 'undefined';
                console.log(`Subject: "${subject}"`);
                
                // Get students in this classroom
                const studentsSnap = await db.collection("students")
                    .where("classCode", "==", classroomId)
                    .get();
                
                console.log(`\n--- Student Processing ---`);
                console.log(`Found ${studentsSnap.size} students in this classroom`);
                
                for (const studentDoc of studentsSnap.docs) {
                    const student = studentDoc.data();
                    const studentId = student.studentId;
                    
                    if (!studentId) {
                        console.log(`WARNING: Student missing studentId. Doc ID: ${studentDoc.id}`);
                        continue;
                    }
                    
                    console.log(`\nChecking student: ${student.fullName || studentId}`);
                    
                    // Check if attendance exists for this session (today, for this subject if available)
                    const sessionDateStart = new Date(todayStr + "T00:00:00.000Z");
                    const sessionDateEnd = new Date(todayStr + "T23:59:59.999Z");
                    
                    let attendanceQuery = db.collection("attendance")
                      .where("classCode", "==", classroomId)
                      .where("studentId", "==", studentId)
                      .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(sessionDateStart))
                      .where("timestamp", "<=", admin.firestore.Timestamp.fromDate(sessionDateEnd));
                    
                    // If the session has a subject, include it in the query
                    if (session.subject) {
                      console.log(`Including subject in query: ${session.subject}`);
                      attendanceQuery = attendanceQuery.where("subject", "==", session.subject);
                    }
                    
                    const attendanceSnap = await attendanceQuery.get();
                    
                    if (attendanceSnap.empty) {
                        console.log(`No attendance record found - SHOULD BE MARKED ${isAfterClassEnded ? 'ABSENT' : 'LATE'}`);
                    } else {
                        console.log(`Found ${attendanceSnap.size} attendance records - WILL BE SKIPPED`);
                        attendanceSnap.forEach(doc => {
                            const record = doc.data();
                            console.log(`  - Status: ${record.status}, IsLate: ${record.isLate}, Subject: ${record.subject || 'none'}`);
                        });
                    }
                }
            } else {
                console.log(`\n*** THIS SESSION SHOULD NOT BE PROCESSED NOW ***`);
            }
        }
        
        console.log(`\n=== SUMMARY ===`);
        console.log(`Found ${validSessionsForToday} valid sessions for ${todayDay}`);
        
    } catch (error) {
        console.error('Error in debug script:', error);
    }
}

debugAttendanceSystem();
'@ | Out-File -FilePath "$PSScriptRoot\debug-attendance-system.js" -Encoding utf8

Write-Host "`n== RUNNING DEBUG SCRIPT ==" -ForegroundColor Blue

node "$PSScriptRoot\debug-attendance-system.js"

# Cleanup
# Remove-Item "$PSScriptRoot\debug-attendance-system.js"

Write-Host "`nDebug complete. If issues persist, check the server logs for more details." -ForegroundColor Green
