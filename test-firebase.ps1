# PowerShell script to test Firebase connection
# To run: .\test-firebase.ps1

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
    exit 1
}

Write-Host "Testing Firebase connection..." -ForegroundColor Cyan

# Create a temporary JavaScript file to test Firebase connection
$tempScriptPath = Join-Path $PSScriptRoot "temp-firebase-test.js"

@"
// Temporary script to test Firebase connection
const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin
try {
    const serviceAccountJSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    
    if (!serviceAccountJSON) {
        console.error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is missing');
        process.exit(1);
    }
    
    console.log('Service account JSON length:', serviceAccountJSON.length, 'characters');
    
    try {
        const serviceAccount = JSON.parse(serviceAccountJSON);
        console.log('Successfully parsed JSON. Project ID:', serviceAccount.project_id);
        
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        
        console.log('Firebase Admin initialized successfully');
        
        const db = admin.firestore();
        console.log('Firestore database initialized');
        
        // Test query - get classrooms
        async function testQuery() {
            try {
                console.log('Testing classroom query...');
                const classroomsSnap = await db.collection('classrooms').limit(5).get();
                console.log('Query executed successfully');
                console.log('Found', classroomsSnap.size, 'classrooms');
                
                if (classroomsSnap.empty) {
                    console.log('No classrooms found. You may need to create some test data first.');
                } else {
                    console.log('First classroom ID:', classroomsSnap.docs[0].id);
                    const classData = classroomsSnap.docs[0].data();
                    
                    // Check for sessions
                    if (classData.sessions && classData.sessions.length > 0) {
                        console.log('First classroom sessions:', JSON.stringify(classData.sessions, null, 2));
                    } else {
                        console.log('No sessions found in the first classroom');
                    }
                    
                    // Check for students
                    const studentsSnap = await db.collection('students')
                        .where('classCode', '==', classroomsSnap.docs[0].id)
                        .limit(5)
                        .get();
                        
                    console.log('Found', studentsSnap.size, 'students in this classroom');
                }
                
                // Test current date and day of week
                const now = new Date();
                const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                const todayDay = daysOfWeek[now.getDay()];
                
                console.log('Current date/time:', now.toISOString());
                console.log('Today is', todayDay);
                
                process.exit(0);
            } catch (error) {
                console.error('Error executing test query:', error);
                process.exit(1);
            }
        }
        
        testQuery();
        
    } catch (parseError) {
        console.error('Failed to parse service account JSON:', parseError);
        console.error('First 100 chars of JSON:', serviceAccountJSON.substring(0, 100) + '...');
        process.exit(1);
    }
} catch (error) {
    console.error('Firebase initialization error:', error);
    process.exit(1);
}
"@ | Out-File -FilePath $tempScriptPath -Encoding utf8

try {
    # Install required packages
    Write-Host "Installing required Node.js packages..." -ForegroundColor Cyan
    npm install --no-save firebase-admin
    
    # Run the temporary script
    Write-Host "Testing Firebase connection..." -ForegroundColor Cyan
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
