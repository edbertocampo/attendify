// Check attendance records
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

async function checkAttendance() {
    try {
        // Get current date
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
        const sessionDateStart = new Date(todayStr + "T00:00:00.000Z");
        const sessionDateEnd = new Date(todayStr + "T23:59:59.999Z");
        
        console.log(`Checking attendance records for classroom ${classroomId} on ${todayStr}`);
        
        // Get attendance records
        const attendanceQuery = db.collection("attendance")
          .where("classCode", "==", classroomId)
          .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(sessionDateStart))
          .where("timestamp", "<=", admin.firestore.Timestamp.fromDate(sessionDateEnd));
          
        const attendanceSnap = await attendanceQuery.get();
        
        console.log(`Found ${attendanceSnap.size} attendance records for today.`);
        
        if (attendanceSnap.size > 0) {
            attendanceSnap.forEach(doc => {
                const attendance = doc.data();
                console.log(`\nAttendance Record ID: ${doc.id}`);
                console.log(`Student ID: ${attendance.studentId}`);
                console.log(`Student Name: ${attendance.studentName}`);
                console.log(`Status: ${attendance.status}`);
                console.log(`Is Late: ${attendance.isLate}`);
                console.log(`Subject: ${attendance.subject}`);
                if (attendance.timestamp) {
                    console.log(`Timestamp: ${attendance.timestamp.toDate()}`);
                }
            });
        }
        
        // Get students in this classroom for cross-reference
        const studentsSnap = await db.collection("students")
            .where("classCode", "==", classroomId)
            .get();
            
        console.log(`\nThis classroom has ${studentsSnap.size} students enrolled:`);
        studentsSnap.forEach(doc => {
            const student = doc.data();
            console.log(`- ${student.studentId}: ${student.fullName || 'No Name'}`);
        });
        
    } catch (error) {
        console.error('Error checking attendance:', error);
    }
}

checkAttendance();
