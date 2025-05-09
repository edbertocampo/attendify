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
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SettingsIcon from "@mui/icons-material/Settings";
import { signOut, onAuthStateChanged } from "firebase/auth";
import LoadingOverlay from "../../../components/LoadingOverlay";
import AddIcon from "@mui/icons-material/Add";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Fab from "@mui/material/Fab";

interface ClassData {
  id: string;
  classCode: string;
  className: string;
  fullName: string;
  subjects?: Subject[];
  schedule?: {
    startTime?: string;
    endTime?: string;
    startTime24?: string;
    endTime24?: string;
  };
  sessions?: { day: string; startTime: string; endTime: string }[];
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
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);

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
              .map(async (docSnap) => {
                // Fetch subjects for this class
                const subjectsQuery = query(
                  collection(db, 'subjects'),
                  where('classCode', '==', docSnap.data().classCode),
                  where('isArchived', 'in', [false, null])
                );
                const subjectsSnapshot = await getDocs(subjectsQuery);
                const subjects = subjectsSnapshot.docs.map(subDoc => ({
                  code: subDoc.id,
                  ...subDoc.data()
                }));
                // Fetch classroom schedule and sessions
                const classCode = docSnap.data().classCode;
                const classroomRef = doc(db, 'classrooms', classCode);
                const classroomDoc = await getDoc(classroomRef);
                let schedule = undefined;
                let sessions = undefined;
                if (classroomDoc.exists()) {
                  const data = classroomDoc.data() as any;
                  schedule = {
                    startTime: data.schedule?.startTime,
                    endTime: data.schedule?.endTime,
                    startTime24: data.schedule?.startTime24,
                    endTime24: data.schedule?.endTime24,
                  };
                  if (Array.isArray(data.sessions)) {
                    sessions = data.sessions;
                  }
                }
                return {
                  id: docSnap.id,
                  classCode: docSnap.data().classCode,
                  className: docSnap.data().className,
                  fullName: docSnap.data().fullName,
                  subjects: subjects,
                  schedule,
                  sessions,
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
      let schedule = undefined;
      if (classData.schedule) {
        schedule = {
          startTime: classData.schedule.startTime,
          endTime: classData.schedule.endTime,
          startTime24: classData.schedule.startTime24,
          endTime24: classData.schedule.endTime24,
        };
      }

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
          schedule,
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
        display: "flex",
        minHeight: "100vh",
        bgcolor: "#f4f7fd", // match instructor dashboard background
        fontFamily: 'Roboto, Arial, sans-serif',
      }}
    >
      {/* Sidebar */}
      <Box
        sx={{
          width: { xs: '70px', md: '240px' }, // match instructor sidebar width
          bgcolor: "#fff",
          borderRight: "1px solid #e3e8f7", // match instructor sidebar border
          display: "flex",
          flexDirection: "column",
          py: 2,
          px: { xs: 1, md: 2 },
          position: "fixed",
          height: "100vh",
          zIndex: 10,
          boxShadow: 'none',
        }}
      >
        {/* Logo */}
        <Box sx={{ px: 3, py: 2, mb: 4 }}>
          <Typography
            sx={{
              fontSize: '1.5rem',
              fontWeight: 600,
              color: '#334eac',
              display: { xs: 'none', md: 'block' }
            }}
          >
            Attendify
          </Typography>
          <Typography
            sx={{
              fontSize: '1.5rem',
              fontWeight: 600,
              color: '#334eac',
              display: { xs: 'block', md: 'none' }
            }}
          >
            E
          </Typography>
        </Box>
        {/* Navigation Items */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, px: 2 }}>
          <Button
            startIcon={<SchoolIcon />}
            sx={{
              justifyContent: 'flex-start',
              color: '#334eac',
              bgcolor: 'rgba(51, 78, 172, 0.08)',
              borderRadius: '10px',
              py: { xs: 1, md: 1.5 },
              px: { xs: 1.5, md: 2 },
              minWidth: 0,
              width: '100%',
              '&:hover': { bgcolor: 'rgba(51, 78, 172, 0.12)' },
              '& .MuiButton-startIcon': {
                margin: 0,
                mr: { xs: 0, md: 2 },
                minWidth: { xs: 24, md: 'auto' }
              }
            }}
            disabled
          >
            <Typography
              sx={{
                display: { xs: 'none', md: 'block' },
                fontWeight: 500
              }}
            >
              My Classes
            </Typography>
          </Button>
          <Button
            startIcon={<SettingsIcon />}
            sx={{
              justifyContent: 'flex-start',
              color: '#64748b',
              borderRadius: '10px',
              py: { xs: 1, md: 1.5 },
              px: { xs: 1.5, md: 2 },
              minWidth: 0,
              width: '100%',
              '&:hover': { bgcolor: 'rgba(51, 78, 172, 0.06)' },
              '& .MuiButton-startIcon': {
                margin: 0,
                mr: { xs: 0, md: 2 },
                minWidth: { xs: 24, md: 'auto' }
              }
            }}
            disabled
          >
            <Typography
              sx={{
                display: { xs: 'none', md: 'block' },
                fontWeight: 500
              }}
            >
              Settings
            </Typography>
          </Button>
        </Box>
        <Box sx={{ mt: "auto", width: "100%" }}>
          <Button
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
            sx={{
              justifyContent: 'flex-start',
              color: '#ea4335',
              borderRadius: '10px',
              py: { xs: 1, md: 1.5 },
              px: { xs: 1.5, md: 2 },
              minWidth: 0,
              width: '100%',
              fontWeight: 500,
              fontSize: { xs: '0.98rem', md: '1.01rem' },
              background: 'none',
              '&:hover': { bgcolor: '#fbe9e7' },
            }}
          >
            <Typography sx={{ display: { xs: 'none', md: 'inline' } }}>Sign Out</Typography>
          </Button>
        </Box>
      </Box>
      {/* Main Content */}
      <Box
        sx={{
          flexGrow: 1,
          ml: { xs: '70px', md: '240px' },
          p: { xs: 2, sm: 3, md: 4 },
          width: '100%',
          minHeight: '100vh',
          bgcolor: '#f4f7fd', // match instructor dashboard background
        }}
      >
        {loading && <LoadingOverlay isLoading={loading} message="Loading your classes..." />}
        <Typography variant="h4" fontWeight={700} color="#334eac" mb={3} sx={{ letterSpacing: 0.5 }}>
          Welcome, {fullName || "Student"}!
        </Typography>
        {/* Enrolled Classes Grid */}
        {loading ? (
          <CircularProgress />
        ) : enrolledClasses.length > 0 ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(auto-fill, minmax(320px, 1fr))",
                md: "repeat(auto-fill, minmax(340px, 1fr))"
              },
              gap: 3, // match instructor dashboard gap
              mb: 4, // match instructor dashboard margin bottom
              px: { xs: 0, sm: 2 },
            }}
          >
            {enrolledClasses.map((classData) => (
              <Paper
                key={classData.id}
                elevation={0}
                sx={{
                  p: 3, // match instructor dashboard padding
                  minHeight: { xs: "170px", sm: "200px" },
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: '16px', // match instructor dashboard border radius
                  border: '1px solid rgba(0,0,0,0.08)', // match instructor dashboard border
                  bgcolor: 'white', // match instructor dashboard background
                  boxShadow: 'none',
                  transition: "box-shadow 0.25s cubic-bezier(.4,0,.2,1), transform 0.18s cubic-bezier(.4,0,.2,1)",
                  cursor: "pointer",
                  '&:hover': { boxShadow: '0 8px 32px 0 rgba(66,133,244,0.13)', transform: 'translateY(-4px) scale(1.025)' },
                  overflow: 'hidden',
                }}
                onClick={() => handleClassClick(classData.classCode)}
              >
                <Typography variant="h6" fontWeight={700} color="#334eac" mb={1} sx={{ fontSize: 22, letterSpacing: 0.2 }}>
                  {classData.className}
                </Typography>
                <Typography sx={{ color: '#64748b', fontSize: '0.92rem', mb: 1 }}>
                  {Array.isArray(classData.sessions) && classData.sessions.length > 0 ? (
                    <>
                      Schedule:{' '}
                      {classData.sessions.map((s, idx) => (
                        <span key={idx} style={{ display: 'block', fontSize: '0.92rem' }}>
                          {s.day}: {s.startTime} - {s.endTime}
                        </span>
                      ))}
                    </>
                  ) : (
                    <>Schedule: {classData.schedule?.startTime || 'N/A'} - {classData.schedule?.endTime || 'N/A'}</>
                  )}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                  {classData.subjects?.map((subject) => (
                    <Button
                      key={subject.code}
                      variant="outlined"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSubjectClick(classData.classCode, subject);
                      }}
                      sx={{
                        borderRadius: '11px',
                        textTransform: 'none',
                        fontWeight: 500,
                        fontSize: 15,
                        borderColor: '#e0e0e0',
                        color: '#334eac',
                        bgcolor: '#f4f7fd',
                        '&:hover': { borderColor: '#334eac', bgcolor: '#e3e8f7' },
                      }}
                    >
                      {subject.name}
                    </Button>
                  ))}
                </Box>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLeaveClass(classData.id);
                  }}
                  sx={{
                    borderRadius: '9px',
                    alignSelf: 'flex-end',
                    fontWeight: 500,
                    fontSize: 13,
                    borderColor: '#fbe9e7',
                    color: '#ea4335',
                    '&:hover': { borderColor: '#ea4335', bgcolor: '#fbe9e7' },
                  }}
                  startIcon={<ExitToAppIcon />}
                >
                  Leave
                </Button>
              </Paper>
            ))}
          </Box>
        ) : (
          <Typography sx={{ mt: 2, color: '#64748b' }}>
            No enrolled classes. Join a class using the class code above.
          </Typography>
        )}
        {/* Floating Action Button for Join Class */}
        <Fab
          color="primary"
          aria-label="join class"
          sx={{
            position: "fixed",
            bottom: 36,
            right: 36,
            zIndex: 1200,
            bgcolor: "#334eac",
            color: '#fff',
            boxShadow: '0 4px 16px 0 rgba(51,78,172,0.18)',
            '&:hover': { bgcolor: "#22336b" },
          }}
          onClick={() => setJoinDialogOpen(true)}
        >
          <AddIcon />
        </Fab>
        <Dialog open={joinDialogOpen} onClose={() => setJoinDialogOpen(false)} disableScrollLock>
          <DialogTitle sx={{ fontWeight: 700, color: '#334eac' }}>Join a Class</DialogTitle>
          <DialogContent>
            <TextField
              label="Enter Class Code"
              variant="outlined"
              value={classCode}
              onChange={(e) => setClassCode(e.target.value)}
              sx={{ mt: 1, minWidth: 300 }}
              autoFocus
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setJoinDialogOpen(false)} color="secondary">Cancel</Button>
            <Button
              onClick={async () => {
                await handleJoinClass();
                setJoinDialogOpen(false);
              }}
              variant="contained"
              color="primary"
              sx={{ fontWeight: "bold", borderRadius: "10px", bgcolor: '#334eac', '&:hover': { bgcolor: '#22336b' } }}
            >
              Join
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default StudentDashboard;
