import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

export const autoMarkAbsents = functions.pubsub
  .schedule("every 15 minutes")
  .onRun(async () => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    // 1. Get all non-archived classrooms
    const classroomsSnap = await db
      .collection("classrooms")
      .where("archived", "==", false)
      .get();

    for (const classroomDoc of classroomsSnap.docs) {
      const classroom = classroomDoc.data();
      const classCode = classroomDoc.id;
      const sessions = Array.isArray(classroom.sessions) ?
        classroom.sessions :
        [];
      if (!sessions.length) continue;

      // 2. For each session, check if it ended today
      for (const session of sessions) {
        // session.day: e.g. "Monday", "Tuesday", etc.
        // session.endTime: e.g. "09:00"
        const sessionDay = session.day;
        const sessionEndTime = session.endTime; // "HH:mm"

        // Check if today matches session day
        const daysOfWeek = [
          "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday",
          "Friday", "Saturday",
        ];
        const todayDay = daysOfWeek[now.getDay()];
        if (todayDay !== sessionDay) continue;

        // Build Date object for today's session end
        const [endHour, endMinute] = sessionEndTime.split(":").map(Number);
        const sessionEnd = new Date(now);
        sessionEnd.setHours(endHour, endMinute, 0, 0);

        // If session ended within the last 30 minutes
        if (now > sessionEnd &&
          now.getTime() - sessionEnd.getTime() < 30 * 60 * 1000) {
          // 3. Get all students in this class
          const studentsSnap = await db.collection("students")
            .where("classCode", "==", classCode)
            .get();

          for (const studentDoc of studentsSnap.docs) {
            const student = studentDoc.data();
            const studentId = student.studentId;

            // 4. Check if attendance exists for this session (today)
            const attendanceSnap = await db.collection("attendance")
              .where("classCode", "==", classCode)
              .where("studentId", "==", studentId)
              .where("timestamp", ">=", new Date(todayStr + "T00:00:00"))
              .where("timestamp", "<=", new Date(todayStr + "T23:59:59"))
              .get();

            if (attendanceSnap.empty) {
              // 5. Mark as absent
              await db.collection("attendance").add({
                classCode,
                studentId,
                studentName: student.fullName || "",
                subject: null,
                timestamp: admin.firestore.Timestamp.fromDate(sessionEnd),
                status: "absent",
                proofImage: null,
                excuse: null,
                excuseFile: null,
                submittedTime: admin.firestore.Timestamp.now(),
                isLate: false,
                geolocation: null,
              });
            }
          }
        }
      }
    }
    return null;
  });
