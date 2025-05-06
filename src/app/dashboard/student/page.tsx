"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "../../../lib/firebase";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import {
  Box,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  IconButton,
} from "@mui/material";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import SchoolIcon from "@mui/icons-material/School";
import LogoutIcon from "@mui/icons-material/Logout";
import { signOut, onAuthStateChanged } from "firebase/auth";
import LoadingOverlay from "../../../components/LoadingOverlay";

interface ClassData {
  id: string;
  classCode: string;
  className: string;
  fullName: string;
  subjects?: Subject[];
}

interface Subject {
  code: string;
  name: string;
  instructor: string;
}

const StudentDashboard = () => {
  const router = useRouter();
  const [classCode, setClassCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [enrolledClasses, setEnrolledClasses] = useState<ClassData[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string>("");

  // Fetch authenticated student ID and full name
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setStudentId(user.uid);
        
        try {
          // Fetch student's full name from Firestore
          const studentRef = doc(db, "users", user.uid);
          const studentDoc = await getDoc(studentRef);
          if (studentDoc.exists()) {
            setFullName(studentDoc.data().fullName);
          } else {
            setFullName("Unknown Student");
          }

          // Fetch classes
          const q = collection(db, "students");
          const querySnapshot = await getDocs(q);
          const classes = await Promise.all(
            querySnapshot.docs
              .filter((doc) => doc.data().studentId === user.uid)
              .map(async (doc) => {
                // Fetch subjects for this class
                const subjectsQuery = query(
                  collection(db, 'subjects'),
                  where('classCode', '==', doc.data().classCode),
                  where('isArchived', 'in', [false, null])  // Include both false and non-existent archived status
                );
                const subjectsSnapshot = await getDocs(subjectsQuery);
                const subjects = subjectsSnapshot.docs.map(subDoc => ({
                  code: subDoc.id,
                  ...subDoc.data()
                }));

                return {
                  id: doc.id,
                  classCode: doc.data().classCode,
                  className: doc.data().className,
                  fullName: doc.data().fullName,
                  subjects: subjects,
                };
              })
          ) as ClassData[];

          setEnrolledClasses(classes);
        } catch (error) {
          console.error("Error fetching data:", error);
        } finally {
          setLoading(false);
        }
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, []); // Empty dependency array since we only want this to run once on mount

  // Join Class
  const handleJoinClass = async () => {
    if (!classCode || !studentId) {
      alert("Please enter a class code.");
      return;
    }

    if (!fullName) {
      alert("Loading student name... Please try again.");
      return;
    }

    try {
      // Fetch class details from Firestore
      const classRef = doc(db, "classrooms", classCode);
      const classDoc = await getDoc(classRef);

      if (!classDoc.exists()) {
        alert("Class not found!");
        return;
      }

      const classData = classDoc.data();

      // Enroll student with actual full name
      await addDoc(collection(db, "students"), {
        studentId,
        classCode,
        className: classData.name, // Store class name separately
        fullName, // Ensure correct field is used
      });

      // Update UI
      setEnrolledClasses([
        ...enrolledClasses,
        {
          id: classCode,
          classCode,
          className: classData.name,
          fullName,
        },
      ]);
      setClassCode("");
    } catch (error) {
      console.error("Error joining class:", error);
    }
  };

  // Leave Class
  const handleLeaveClass = async (id: string) => {
    try {
      await deleteDoc(doc(db, "students", id));
      setEnrolledClasses(enrolledClasses.filter((c) => c.id !== id));
    } catch (error) {
      console.error("Error leaving class:", error);
    }
  };

  // Logout Function
  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  // Update handleClassClick to handle subject selection
  const handleSubjectClick = (classCode: string, subject: Subject) => {
    router.push(`/dashboard/student/class/${classCode}?subject=${subject.code}`);
  };

  // Add this function to handle classroom click
  const handleClassClick = (classCode: string) => {
    router.push(`/dashboard/student/class/${classCode}`);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f4f6f8",
        padding: 3,
      }}
    >
      {loading && <LoadingOverlay isLoading={loading} message="Loading your classes..." />}
      <Paper
        elevation={3}
        sx={{
          p: 4,
          bgcolor: "background.default",
          color: "text.primary",
          borderRadius: "16px",
          textAlign: "center",
          boxShadow: "0px 10px 30px rgba(0, 0, 0, 0.1)",
          maxWidth: "600px",
          width: "100%",
          position: "relative",
        }}
      >
        {/* Logout Button */}
        <IconButton
          onClick={handleLogout}
          sx={{
            position: "absolute",
            top: 15,
            right: 15,
            color: "#ff3d00",
          }}
        >
          <LogoutIcon />
        </IconButton>

        <SchoolIcon sx={{ fontSize: 50, color: "#007AFF", mb: 1 }} />

        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Student Dashboard
        </Typography>

        {/* Join Class Section */}
        <Box sx={{ display: "flex", gap: 2, mb: 3, justifyContent: "center" }}>
          <TextField
            label="Enter Class Code"
            variant="outlined"
            value={classCode}
            onChange={(e) => setClassCode(e.target.value)}
            sx={{ flex: 1 }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleJoinClass}
            sx={{
              fontWeight: "bold",
              borderRadius: "12px",
              height: "48px",
              background: "#007AFF",
              "&:hover": { background: "#005ECF" },
            }}
          >
            Join Class
          </Button>
        </Box>

        {/* Enrolled Classes Table */}
        {loading ? (
          <CircularProgress />
        ) : enrolledClasses.length > 0 ? (
          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <strong>Class Name</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Subjects</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Actions</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {enrolledClasses.map((classData) => (
                  <TableRow key={classData.id}>
                    <TableCell 
                      onClick={() => handleClassClick(classData.classCode)}
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 122, 255, 0.08)',
                        },
                        fontWeight: 'medium'
                      }}
                    >
                      {classData.className}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {classData.subjects?.map((subject) => (
                          <Button
                            key={subject.code}
                            variant="outlined"
                            size="small"
                            onClick={() => handleSubjectClick(classData.classCode, subject)}
                            sx={{
                              borderRadius: '12px',
                              textTransform: 'none',
                            }}
                          >
                            {subject.name}
                          </Button>
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLeaveClass(classData.id);
                        }}
                      >
                        <ExitToAppIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography sx={{ mt: 2 }}>
            No enrolled classes. Join a class using the class code above.
          </Typography>
        )}
      </Paper>
    </Box>
  );
};

export default StudentDashboard;
