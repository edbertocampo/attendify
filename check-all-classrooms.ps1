# Check all classrooms for Wednesday sessions
# This script will examine all classrooms in the system to find those with Wednesday sessions

@'
// Comprehensive classroom scanner
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

async function scanAllClassrooms() {
    try {
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
        const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const todayDay = daysOfWeek[now.getDay()];
        
        console.log("===== ALL CLASSROOMS WITH WEDNESDAY SESSIONS =====");
        console.log(`Current Time: ${now.toISOString()} (${todayDay})`);
        
        // Get all classrooms
        const classroomsSnap = await db.collection("classrooms").get();
        
        console.log(`\nTotal classrooms in system: ${classroomsSnap.size}`);
        
        let wednesdayClassrooms = 0;
        let qualifyingWednesdaySessions = 0;
        let totalWednesdaySessions = 0;
        
        for (const classroomDoc of classroomsSnap.docs) {
            const classroom = classroomDoc.data();
            const classCode = classroomDoc.id;
            const sessions = Array.isArray(classroom.sessions) ? classroom.sessions : [];
            
            const wednesdaySessions = sessions.filter(session => {
                if (!session.day) return false;
                const normalizedDay = session.day.charAt(0).toUpperCase() + session.day.slice(1).toLowerCase();
                return normalizedDay === "Wednesday";
            });
            
            if (wednesdaySessions.length === 0) continue;
            
            wednesdayClassrooms++;
            totalWednesdaySessions += wednesdaySessions.length;
            
            console.log(`\n---- Classroom: ${classroom.name || classCode} ----`);
            console.log(`ID: ${classCode}`);
            console.log(`Archived: ${classroom.archived === true ? 'Yes' : 'No'}`);
            console.log(`Wednesday Sessions: ${wednesdaySessions.length}`);
            
            let classroomQualifyingSessions = 0;
            
            for (const session of wednesdaySessions) {
                // Normalize time formats
                const sessionEndTime = normalizeTimeFormat(session.endTime);
                if (!sessionEndTime) {
                    console.log(`- Session with invalid end time: ${session.endTime}`);
                    continue;
                }
                
                const [endHour, endMinute] = sessionEndTime.split(":").map(Number);
                const sessionEnd = new Date(now);
                sessionEnd.setHours(endHour, endMinute, 0, 0);
                
                const timeDiffFromEnd = now.getTime() - sessionEnd.getTime();
                const thirtyMinutesInMillis = 30 * 60 * 1000;
                
                const isAfterClassEnded = now > sessionEnd && timeDiffFromEnd < thirtyMinutesInMillis && timeDiffFromEnd >= 0;
                
                console.log(`- Session ending at ${sessionEndTime} (${Math.round(timeDiffFromEnd / 60000)} minutes ago)`);
                console.log(`  Subject: ${session.subject || 'None'}`);
                console.log(`  Qualifies for absent marking: ${isAfterClassEnded}`);
                
                if (isAfterClassEnded) {
                    qualifyingWednesdaySessions++;
                    classroomQualifyingSessions++;
                }
            }
            
            // Check if the classroom has students
            const studentsSnap = await db.collection("students")
                .where("classCode", "==", classCode)
                .get();
            
            console.log(`Students in classroom: ${studentsSnap.size}`);
            console.log(`Qualifying Wednesday sessions: ${classroomQualifyingSessions}`);
        }
        
        console.log("\n===== SUMMARY =====");
        console.log(`Classrooms with Wednesday sessions: ${wednesdayClassrooms}`);
        console.log(`Total Wednesday sessions: ${totalWednesdaySessions}`);
        console.log(`Sessions currently qualifying for absent marking: ${qualifyingWednesdaySessions}`);
        
    } catch (error) {
        console.error('Error scanning classrooms:', error);
    }
}

scanAllClassrooms();
'@ | Out-File -FilePath "$PSScriptRoot\check-all-classrooms.js" -Encoding utf8

Write-Host "Scanning all classrooms for Wednesday sessions..." -ForegroundColor Cyan
node check-all-classrooms.js
