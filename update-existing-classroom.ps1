# PowerShell script to create a test session for an existing classroom
# To run: .\update-existing-classroom.ps1

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

Write-Host "This script will update an existing classroom with a session ending in 5 minutes." -ForegroundColor Yellow
$classroomId = Read-Host "Enter the ID of the classroom to update (e.g. 4emnQYv9NjIuyBKNQXC9)"

if (-not $classroomId) {
    Write-Host "No classroom ID provided. Exiting." -ForegroundColor Red
    exit 1
}

# Calculate times
$now = Get-Date
$endTime = $now.AddMinutes(5)
$endHour = $endTime.Hour
$endMinute = $endTime.Minute
$formattedEndTime = "{0:D2}:{1:D2}" -f $endHour, $endMinute

$startTime = $endTime.AddMinutes(-20)
$startHour = $startTime.Hour
$startMinute = $startTime.Minute
$formattedStartTime = "{0:D2}:{1:D2}" -f $startHour, $startMinute

$daysOfWeek = @("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")
$todayDay = $daysOfWeek[$now.DayOfWeek.value__]

Write-Host "Creating session for classroom $classroomId with the following parameters:"
Write-Host "Day: $todayDay" -ForegroundColor Cyan
Write-Host "Start time: $formattedStartTime" -ForegroundColor Cyan
Write-Host "End time: $formattedEndTime" -ForegroundColor Cyan
Write-Host "Current time: $($now.ToString('HH:mm'))" -ForegroundColor Cyan

$confirm = Read-Host "Do you want to continue? (y/n)"
if ($confirm -ne "y") {
    Write-Host "Operation cancelled." -ForegroundColor Red
    exit 0
}

@'
// Temporary script to update a classroom with a new session
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
const classroomId = process.argv[2];
const todayDay = process.argv[3];
const startTime = process.argv[4];
const endTime = process.argv[5];

async function updateClassroom() {
    try {
        // Get the current classroom data
        const classroomRef = db.collection('classrooms').doc(classroomId);
        const classroomDoc = await classroomRef.get();
        
        if (!classroomDoc.exists) {
            console.error(`Classroom with ID ${classroomId} does not exist.`);
            process.exit(1);
        }
        
        const classroom = classroomDoc.data();
        console.log(`Found classroom: ${classroom.name || classroomId}`);
        
        // Get students in this classroom
        const studentsSnap = await db.collection("students")
            .where("classCode", "==", classroomId)
            .get();
        
        console.log(`This classroom has ${studentsSnap.size} students enrolled.`);
        
        // Prepare the new session
        const newSession = {
            day: todayDay,
            startTime: startTime,
            endTime: endTime,
            subject: "Test Session"
        };
        
        // Update the classroom with the new session
        const sessions = Array.isArray(classroom.sessions) ? [...classroom.sessions] : [];
        sessions.push(newSession);
        
        await classroomRef.update({
            sessions: sessions
        });
        
        console.log(`Updated classroom ${classroomId} with new session:`);
        console.log(`- Day: ${todayDay}`);
        console.log(`- Start Time: ${startTime}`);
        console.log(`- End Time: ${endTime}`);
        console.log(`- Subject: Test Session`);
        
        // Current time info
        const now = new Date();
        const [endHour, endMinute] = endTime.split(':').map(Number);
        const sessionEnd = new Date(now);
        sessionEnd.setHours(endHour, endMinute, 0, 0);
        
        const minutesUntilEnd = Math.round((sessionEnd - now) / 60000);
        
        console.log(`\nSession will end at ${sessionEnd.toLocaleTimeString()}`);
        console.log(`That's approximately ${minutesUntilEnd} minutes from now.`);
        console.log('\nYou can now run the autoMarkAbsents API to test attendance marking for this session.');
        
    } catch (error) {
        console.error('Error updating classroom:', error);
        process.exit(1);
    }
}

if (!classroomId) {
    console.error('No classroom ID provided. Usage: node script.js <classroomId> <day> <startTime> <endTime>');
    process.exit(1);
}

updateClassroom();
'@ | Out-File -FilePath "$PSScriptRoot\temp-update-classroom.js" -Encoding utf8

# Run the script
Write-Host "Updating classroom..." -ForegroundColor Cyan
node "$PSScriptRoot\temp-update-classroom.js" "$classroomId" "$todayDay" "$formattedStartTime" "$formattedEndTime"

# Clean up
Remove-Item "$PSScriptRoot\temp-update-classroom.js"

Write-Host "`nWait for the session to progress, then run:'.\simple-trigger.ps1' to test the autoMarkAbsents API" -ForegroundColor Green
