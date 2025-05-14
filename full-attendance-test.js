// Full auto-attendance debug script
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
const classroomId = process.argv[2] || '4emnQYv9NjIuyBKNQXC9';

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

// Create a test session for right now
async function createNowSession() {
    // Set times for a session that ends 5 minutes from now
    const now = new Date();
    const endTime = new Date(now.getTime() + 5 * 60000); // 5 minutes from now
    
    const startTime = new Date(endTime.getTime() - 30 * 60000); // 30 minutes before end
    
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayDay = daysOfWeek[now.getDay()];
    
    // Format times in 24-hour format
    const formattedStartTime = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
    const formattedEndTime = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
    
    console.log(`\n==== CREATING IMMEDIATE TEST SESSION ====`);
    console.log(`Creating session for today (${todayDay})`);
    console.log(`Start Time: ${formattedStartTime}`);
    console.log(`End Time: ${formattedEndTime}`);
    console.log(`Current Time: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
    
    try {
        const classroomRef = db.collection('classrooms').doc(classroomId);
        const classroomDoc = await classroomRef.get();
        
        if (!classroomDoc.exists) {
            console.error(`Classroom with ID ${classroomId} does not exist.`);
            return false;
        }
        
        const classroom = classroomDoc.data();
        const sessions = Array.isArray(classroom.sessions) ? [...classroom.sessions] : [];
        
        // Add new session
        sessions.push({
            day: todayDay,
            startTime: formattedStartTime,
            endTime: formattedEndTime,
            subject: "Immediate Test Session"
        });
        
        // Update the classroom
        await classroomRef.update({ sessions });
        
        console.log(`Added new session to classroom ${classroomId}`);
        return true;
    } catch (error) {
        console.error('Error creating session:', error);
        return false;
    }
}

// Run the full attendance process manually
async function processAttendance() {
    try {
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
        const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const todayDay = daysOfWeek[now.getDay()];
        
        console.log(`\n==== PROCESSING ATTENDANCE FOR TEST CLASSROOM ====`);
        console.log(`Current time: ${now.toISOString()} (${todayDay})`);
        
        // Get the classroom
        const classroomRef = db.collection('classrooms').doc(classroomId);
        const classroomDoc = await classroomRef.get();
        
        if (!classroomDoc.exists) {
            console.error(`Classroom with ID ${classroomId} not found`);
            return;
        }
        
        const classroom = classroomDoc.data();
        const sessions = Array.isArray(classroom.sessions) ? classroom.sessions : [];
        
        console.log(`Classroom: ${classroom.name || classroomId}`);
        console.log(`Sessions count: ${sessions.length}`);
        
        let processedSessions = 0;
        let markedAbsentCount = 0;
        let markedLateCount = 0;
        
        for (const session of sessions) {
            // Validate session structure
            if (!session.day) {
                console.log(`Session has missing day. Skipping.`);
                continue;
            }
            
            if (!session.endTime) {
                console.log(`Session has missing endTime. Skipping.`);
                continue;
            }
            
            // Normalize the session day
            const normalizedDay = session.day.charAt(0).toUpperCase() + session.day.slice(1).toLowerCase();
            const sessionDay = normalizedDay;
            
            if (todayDay !== sessionDay) {
                console.log(`Session day "${sessionDay}" does not match today (${todayDay}). Skipping.`);
                continue; // Not the correct day for this session
            }
            
            // Normalize time formats
            const sessionEndTime = normalizeTimeFormat(session.endTime);
            if (!sessionEndTime) {
                console.log(`Invalid endTime format: ${session.endTime}. Skipping.`);
                continue;
            }
            
            processedSessions++;
            
            const [endHour, endMinute] = sessionEndTime.split(":").map(Number);
            const sessionEnd = new Date(now); // Use a copy of 'now' to avoid modifying it
            sessionEnd.setHours(endHour, endMinute, 0, 0); // Set to today's date with session's end time
            
            // Normalize the start time as well
            const sessionStartTime = normalizeTimeFormat(session.startTime);
            if (!sessionStartTime) {
                console.log(`Invalid startTime format: ${session.startTime}. Using default.`);
            }
            
            // Parse start time
            let startHour = 0;
            let startMinute = 0;
            
            if (sessionStartTime) {
                [startHour, startMinute] = sessionStartTime.split(":").map(Number);
            }
            
            const sessionStart = new Date(now);
            sessionStart.setHours(startHour, startMinute, 0, 0);
            
            // Calculate grace period end (15 minutes after start)
            const gracePeriodEnd = new Date(sessionStart.getTime() + 15 * 60 * 1000);
            
            // Calculate time differences
            const timeDiffFromEnd = now.getTime() - sessionEnd.getTime();
            const timeDiffFromGracePeriod = now.getTime() - gracePeriodEnd.getTime();
            const thirtyMinutesInMillis = 30 * 60 * 1000;
            
            console.log(`\n-- Session Analysis --`);
            console.log(`Session Day: ${sessionDay}`);
            console.log(`Start Time: ${sessionStartTime}`);
            console.log(`End Time: ${sessionEndTime}`);
            console.log(`Subject: ${session.subject || 'None'}`);
            console.log(`Current Time: ${now.toLocaleTimeString()}`);
            console.log(`Minutes since end: ${Math.round(timeDiffFromEnd / 60000)}`);
            console.log(`Minutes since grace period: ${Math.round(timeDiffFromGracePeriod / 60000)}`);
            
            // Check if the session has ended today and within the last 30 minutes
            const isAfterClassEnded = now > sessionEnd && timeDiffFromEnd < thirtyMinutesInMillis && timeDiffFromEnd >= 0;
            
            // Check if we're after the grace period but before class end
            const isAfterGracePeriod = now > gracePeriodEnd && now <= sessionEnd;
            
            console.log(`Should mark ABSENT: ${isAfterClassEnded}`);
            console.log(`Should mark LATE: ${isAfterGracePeriod}`);
            
            if (isAfterClassEnded || isAfterGracePeriod) {
                const processingType = isAfterClassEnded ? 'ABSENT' : 'LATE';
                console.log(`\nProcessing session for ${processingType} marking.`);
                
                // Get students in this class
                const studentsSnap = await db.collection("students")
                    .where("classCode", "==", classroomId)
                    .get();
                
                console.log(`Found ${studentsSnap.size} students in this class.`);
                
                if (studentsSnap.empty) {
                    console.log(`No students found for this class.`);
                    continue;
                }
                
                // Process each student
                for (const studentDoc of studentsSnap.docs) {
                    const student = studentDoc.data();
                    const studentId = student.studentId;
                    
                    if (!studentId) {
                        console.log(`Student missing studentId. Doc ID: ${studentDoc.id}. Skipping.`);
                        continue;
                    }
                    
                    console.log(`\nProcessing student: ${student.fullName || studentId}`);
                    
                    // Check if attendance exists for this session
                    const sessionDateStart = new Date(todayStr + "T00:00:00.000Z");
                    const sessionDateEnd = new Date(todayStr + "T23:59:59.999Z");
                    
                    let attendanceQuery = db.collection("attendance")
                        .where("classCode", "==", classroomId)
                        .where("studentId", "==", studentId)
                        .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(sessionDateStart))
                        .where("timestamp", "<=", admin.firestore.Timestamp.fromDate(sessionDateEnd));
                    
                    // If the session has a subject, include it in the query
                    if (session.subject) {
                        console.log(`Adding subject to query: ${session.subject}`);
                        attendanceQuery = attendanceQuery.where("subject", "==", session.subject);
                    }
                    
                    const attendanceSnap = await attendanceQuery.get();
                    
                    console.log(`Attendance records found: ${attendanceSnap.size}`);
                    
                    if (attendanceSnap.empty) {
                        // If we're after class end, mark as absent
                        if (isAfterClassEnded) {
                            const subjectName = session.subject || null;
                            console.log(`Marking ABSENT: Class=${classroomId}, Student=${studentId}, Subject=${subjectName}`);
                            
                            try {
                                // Create attendance record
                                const attendanceRecord = await db.collection("attendance").add({
                                    classCode: classroomId,
                                    studentId,
                                    studentName: student.fullName || "",
                                    subject: subjectName,
                                    timestamp: admin.firestore.Timestamp.fromDate(sessionEnd),
                                    status: "absent",
                                    proofImage: null,
                                    excuse: null,
                                    excuseFile: null,
                                    submittedTime: admin.firestore.Timestamp.now(),
                                    isLate: false,
                                    geolocation: null,
                                });
                                
                                console.log(`Created absence record: ${attendanceRecord.id}`);
                                markedAbsentCount++;
                                
                                // Create notification
                                const notificationRecord = await db.collection("notifications").add({
                                    userId: studentId,
                                    title: "Marked as Absent",
                                    message: `You have been marked as ABSENT in ${classroom.name || classroomId} for ${sessionDay}.`,
                                    type: "error",
                                    read: false,
                                    timestamp: admin.firestore.Timestamp.now(),
                                    relatedDoc: {
                                        type: "attendance",
                                        id: attendanceRecord.id
                                    },
                                    extraData: {
                                        classCode: classroomId,
                                        className: classroom.name || classroomId,
                                        date: sessionEnd.toLocaleDateString()
                                    }
                                });
                                
                                console.log(`Created notification: ${notificationRecord.id}`);
                                
                            } catch (error) {
                                console.error(`Error marking absent:`, error);
                            }
                        }
                        // If we're after grace period but before class end, mark as late
                        else if (isAfterGracePeriod) {
                            const subjectName = session.subject || null;
                            console.log(`Marking LATE: Class=${classroomId}, Student=${studentId}, Subject=${subjectName}`);
                            
                            try {
                                // Create attendance record
                                const attendanceRecord = await db.collection("attendance").add({
                                    classCode: classroomId,
                                    studentId,
                                    studentName: student.fullName || "",
                                    subject: subjectName,
                                    timestamp: admin.firestore.Timestamp.now(),
                                    status: "present",
                                    proofImage: null,
                                    excuse: null,
                                    excuseFile: null,
                                    submittedTime: admin.firestore.Timestamp.now(),
                                    isLate: true,
                                    geolocation: null,
                                });
                                
                                console.log(`Created late record: ${attendanceRecord.id}`);
                                markedLateCount++;
                                
                                // Create notification
                                const notificationRecord = await db.collection("notifications").add({
                                    userId: studentId,
                                    title: "Marked as Late",
                                    message: `You have been marked as LATE in ${classroom.name || classroomId} for ${sessionDay}. Please remember to submit attendance on time.`,
                                    type: "warning",
                                    read: false,
                                    timestamp: admin.firestore.Timestamp.now(),
                                    relatedDoc: {
                                        type: "attendance",
                                        id: attendanceRecord.id
                                    },
                                    extraData: {
                                        classCode: classroomId,
                                        className: classroom.name || classroomId,
                                        date: new Date().toLocaleDateString()
                                    }
                                });
                                
                                console.log(`Created notification: ${notificationRecord.id}`);
                                
                            } catch (error) {
                                console.error(`Error marking late:`, error);
                            }
                        }
                    } else {
                        console.log(`Student already has attendance record for today.`);
                    }
                }
            } else {
                let skipReason = '';
                if (now <= gracePeriodEnd) skipReason = 'still within 15-minute grace period';
                else if (now <= sessionEnd) skipReason = 'time to mark as late has not come yet';
                else if (timeDiffFromEnd >= thirtyMinutesInMillis) skipReason = 'session ended more than 30 minutes ago';
                else if (timeDiffFromEnd < 0) skipReason = 'session end time is in the future';
                else skipReason = 'condition not met for an unknown reason';
                
                console.log(`Not processing this session. Reason: ${skipReason}`);
            }
        }
        
        console.log(`\n==== SUMMARY ====`);
        console.log(`Processed ${processedSessions} sessions for today (${todayDay})`);
        console.log(`Marked ${markedAbsentCount} students absent`);
        console.log(`Marked ${markedLateCount} students late`);
        
    } catch (error) {
        console.error('Error processing attendance:', error);
    }
}

// Main function to run tests
async function runFullTest() {
    console.log('========================');
    console.log('FULL AUTO-ATTENDANCE TEST');
    console.log('========================');
    
    // Step 1: Create an immediate test session
    await createNowSession();
    
    // Step 2: Wait 6 minutes for the session to end
    console.log('\nWaiting 6 minutes for the session to end...');
    console.log('(In a real scenario, you would wait this time before continuing)');
    
    // Since we can't actually wait, we're just going to process immediately with the debug code
    await processAttendance();
}

runFullTest();
