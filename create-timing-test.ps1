# PowerShell script to create test data with a session ending soon
# To run: .\create-timing-test.ps1

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
    Write-Host "Warning: .env.local file not found. Make sure FIREBASE_SERVICE_ACCOUNT_JSON is set in your environment." -ForegroundColor Yellow
    exit 1
}

# This script creates test classroom and student data in Firebase for testing absent marking

Write-Host "This script will create test data in your Firebase database." -ForegroundColor Yellow
Write-Host "It will create a test classroom with a session ending in the next few minutes." -ForegroundColor Yellow
Write-Host "Make sure you have Firebase Admin SDK credentials in your .env.local file." -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "Do you want to continue? (y/n)"

if ($confirm -ne "y") {
    Write-Host "Operation cancelled." -ForegroundColor Red
    exit 0
}

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
}
catch {
    Write-Host "Error: Node.js is not installed or not in PATH. Please install Node.js." -ForegroundColor Red
    exit 1
}

# Create a temporary JavaScript file to interact with Firebase
$tempScriptPath = Join-Path $PSScriptRoot "temp-create-test-data.js"

# Get current time
$now = Get-Date
# Calculate current time + 5 minutes for session end time
$endTime = $now.AddMinutes(5)
$endHour = $endTime.Hour
$endMinute = $endTime.Minute
$formattedEndTime = "{0:D2}:{1:D2}" -f $endHour, $endMinute

# Calculate start time (20 minutes before end time)
$startTime = $endTime.AddMinutes(-20)
$startHour = $startTime.Hour
$startMinute = $startTime.Minute
$formattedStartTime = "{0:D2}:{1:D2}" -f $startHour, $startMinute

# Day of week
$daysOfWeek = @("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")
$todayDay = $daysOfWeek[$now.DayOfWeek.value__]

Write-Host "Creating test data for today ($todayDay)" -ForegroundColor Cyan
Write-Host "Session start time: $formattedStartTime" -ForegroundColor Cyan
Write-Host "Session end time: $formattedEndTime" -ForegroundColor Cyan
Write-Host "Current time: $($now.ToString('HH:mm'))" -ForegroundColor Cyan

@"
// Temporary script to create test data in Firebase
const admin = require('firebase-admin');
const fs = require('fs');

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

// Generate a random class code
const testClassCode = 'TIMING' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');

// Use the provided day and times
const todayDay = '$todayDay';
const sessionStartTime = '$formattedStartTime';
const sessionEndTime = '$formattedEndTime';

async function createTestData() {
    try {
        // 1. Create test classroom
        console.log('Creating test classroom with code: ' + testClassCode);
        await db.collection('classrooms').doc(testClassCode).set({
            name: 'Test Attendance Timing Class',
            instructor: 'test-instructor',
            archived: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            sessions: [
                {
                    day: todayDay,
                    startTime: sessionStartTime,
                    endTime: sessionEndTime,
                    subject: 'Test Timing Subject'
                }
            ]
        });
        console.log('Created classroom with session start at ' + sessionStartTime + ' and ending at ' + sessionEndTime + ' (' + todayDay + ')');
        
        // 2. Create test students
        const studentCount = 3;
        for (let i = 1; i <= studentCount; i++) {
            const studentId = 'timing-student-' + i + '-' + testClassCode;
            await db.collection('students').doc(studentId).set({
                studentId: studentId,
                fullName: 'Timing Test Student ' + i,
                email: 'timing' + i + '@example.com',
                classCode: testClassCode,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log('Created test student: ' + studentId);
        }
        
        console.log('');
        console.log('=== TEST DATA CREATED SUCCESSFULLY ===');
        console.log('Test classroom code:', testClassCode);
        console.log('Session day:', todayDay);
        console.log('Session start time:', sessionStartTime);
        console.log('Session end time:', sessionEndTime);
        console.log('Test student count:', studentCount);
        console.log('');
        console.log('To test the automatic absent marking:');
        console.log('1. Wait for the session to progress:');
        console.log('   - Between start + 15 min and end: Students should be marked LATE');
        console.log('   - After end time but within 30 min: Students should be marked ABSENT');
        console.log('2. Run the trigger script at the appropriate time');
        console.log('3. Check Firebase for new absence/late records');
        
    } catch (error) {
        console.error('Error creating test data:', error);
        process.exit(1);
    }
}

createTestData();
"@ | Out-File -FilePath $tempScriptPath -Encoding utf8

try {
    # Install required packages
    Write-Host "Installing required Node.js packages..." -ForegroundColor Cyan
    npm install --no-save firebase-admin
    
    # Run the temporary script
    Write-Host "Creating test data..." -ForegroundColor Cyan
    node $tempScriptPath
    
    # Clean up
    if (Test-Path $tempScriptPath) {
        Remove-Item $tempScriptPath
    }
}
catch {
    Write-Host "Error: $_" -ForegroundColor Red
    
    # Clean up on error
    if (Test-Path $tempScriptPath) {
        Remove-Item $tempScriptPath
    }
}
