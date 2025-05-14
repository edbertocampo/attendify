# PowerShell script to create test data for a specific classroom
# This helps us verify the auto-mark absent functionality

$envFile = Join-Path $PSScriptRoot ".env.local"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#].*?)=(.*)') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            $value = $value -replace '^"(.*)"$', '$1'
            $value = $value -replace "^'(.*)'$", '$1'
            Set-Item -Path "env:$key" -Value $value
        }
    }
    Write-Host "Loaded environment variables from .env.local" -ForegroundColor Green
} else {
    Write-Host "Error: .env.local file not found" -ForegroundColor Red
    exit 1
}

# Prompt for the classroom code
$classCode = Read-Host "Enter the classroom code to add test students to (e.g., TIMING0541)"

Write-Host "This script will create test student data in the classroom: $classCode" -ForegroundColor Yellow
Write-Host "WARNING: This will create new test records in your Firebase database." -ForegroundColor Yellow
$confirm = Read-Host "Do you want to continue? (y/n)"

if ($confirm -ne "y") {
    Write-Host "Operation cancelled." -ForegroundColor Red
    exit 0
}

# Create a temporary JavaScript file to interact with Firebase
$tempScriptPath = Join-Path $PSScriptRoot "temp-create-test-students.js"

@"
// Temporary script to create test student data
const admin = require('firebase-admin');
const fs = require('fs');

// Class code from parameter
const classCode = '$classCode';
console.log('Creating test data for classroom:', classCode);

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

async function createTestStudents() {
    try {
        // First check if the classroom exists
        const classroomDoc = await db.collection('classrooms').doc(classCode).get();
        
        if (!classroomDoc.exists) {
            console.error('Classroom not found:', classCode);
            process.exit(1);
        }
        
        const classroomData = classroomDoc.data();
        console.log('Found classroom:', classroomData.name || classCode);
        
        // Create 3 test students
        const studentCount = 3;
        const studentsCreated = [];
        
        for (let i = 1; i <= studentCount; i++) {
            const studentId = 'test-student-' + i + '-' + Math.floor(Math.random() * 10000);
            
            await db.collection('students').doc(studentId).set({
                studentId: studentId,
                fullName: 'Test Student ' + i + ' for ' + classCode,
                email: 'test' + i + '@example.com',
                classCode: classCode,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('Created test student:', studentId);
            studentsCreated.push(studentId);
        }
        
        console.log('Test data creation complete.');
        console.log('Created', studentCount, 'test students in classroom', classCode);
        console.log('Student IDs:', studentsCreated.join(', '));
    } catch (error) {
        console.error('Error creating test data:', error);
        process.exit(1);
    }
}

createTestStudents();
"@ | Out-File -FilePath $tempScriptPath -Encoding utf8

try {
    # Install required packages
    Write-Host "Installing required Node.js packages..." -ForegroundColor Cyan
    npm install --no-save firebase-admin
    
    # Run the temporary script
    Write-Host "Creating test students..." -ForegroundColor Cyan
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
