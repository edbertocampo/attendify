# PowerShell script to check classroom structure
# To run: .\check-classrooms.ps1

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

@'
// Temporary script to examine classroom structure
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

async function debugClassroom() {
    try {
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const todayDay = daysOfWeek[now.getDay()];
        
        console.log(`Current time: ${now.toISOString()} (${todayDay})`);
        
        // Get all classrooms
        const classroomsSnap = await db.collection("classrooms").get();
        
        console.log(`Found ${classroomsSnap.size} total classrooms.`);
        console.log('------------------------------------');
        
        for (const doc of classroomsSnap.docs) {
            const classroom = doc.data();
            const sessions = classroom.sessions || [];
            
            console.log(`\nClassroom ID: ${doc.id}`);
            console.log(`Name: ${classroom.name || 'unnamed'}`);
            console.log(`Archived: ${classroom.archived}`);
            console.log(`Sessions: ${sessions.length}`);
            
            if (sessions.length > 0) {
                console.log('\nSession details:');
                sessions.forEach((session, index) => {
                    console.log(`\nSession ${index + 1}:`);
                    console.log(`  Day: "${session.day || 'undefined'}"`);
                    console.log(`  Start Time: ${session.startTime || 'undefined'}`);
                    console.log(`  End Time: ${session.endTime || 'undefined'}`);
                    console.log(`  Subject: ${session.subject || 'undefined'}`);
                    
                    if (session.day === todayDay) {
                        console.log(`  ** This session is for today (${todayDay})!`);
                        
                        if (session.endTime) {
                            const [endHour, endMinute] = session.endTime.split(":").map(Number);
                            const sessionEnd = new Date(now);
                            sessionEnd.setHours(endHour, endMinute, 0, 0);
                            
                            console.log(`  Session end time: ${sessionEnd.toISOString()}`);
                            const diff = (now.getTime() - sessionEnd.getTime()) / 60000;
                            console.log(`  Minutes since end: ${diff}`);
                            
                            if (diff > 0 && diff <= 30) {
                                console.log(`  ** This session ended in the last 30 minutes and should be processed for ABSENT marking!`);
                            }
                        }
                    }
                });
            }
            
            console.log('\n------------------------------------');
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugClassroom();
'@ | Out-File -FilePath "$PSScriptRoot\temp-check-classrooms.js" -Encoding utf8

# Run the debug script with pre-installed firebase-admin
Write-Host "Checking classroom structure..." -ForegroundColor Cyan
node "$PSScriptRoot\temp-check-classrooms.js"

# Clean up
Remove-Item "$PSScriptRoot\temp-check-classrooms.js"
