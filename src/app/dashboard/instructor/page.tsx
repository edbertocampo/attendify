"use client";

import { useState, useEffect } from "react";
import { Box, Paper, Typography, Button, TextField, AppBar, Toolbar, IconButton, Grid, Container, Modal, Backdrop, FormControl, InputLabel, CircularProgress } from "@mui/material";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, query, where, getDocs, doc, updateDoc, onSnapshot } from "firebase/firestore";
import AddIcon from "@mui/icons-material/Add";
import LogoutIcon from "@mui/icons-material/Logout";
import Tooltip from "@mui/material/Tooltip";
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { Badge } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import PeopleIcon from '@mui/icons-material/People';
import DescriptionIcon from '@mui/icons-material/Description';
import MessageIcon from '@mui/icons-material/Message';
import SettingsIcon from '@mui/icons-material/Settings';
import HelpIcon from '@mui/icons-material/Help';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import dynamic from 'next/dynamic';
import LoadingOverlay from '../../../components/LoadingOverlay';
import EditIcon from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

// Create a wrapper component for client-side only rendering
const ClientSideWrapper = dynamic(() => Promise.resolve(({ children }: { children: React.ReactNode }) => <>{children}</>), {
  ssr: false
});

export default function InstructorDashboard() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const [classroomName, setClassroomName] = useState("");
  const [description, setDescription] = useState("");
  const [createdClassroomId, setCreatedClassroomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeStudents, setActiveStudents] = useState(0);
  const [attendanceStats, setAttendanceStats] = useState({
    present: 0,
    late: 0,
    excused: 0,
    absent: 0
  });
  const [studentCounts, setStudentCounts] = useState<{ [key: string]: number }>({});
  const [showArchived, setShowArchived] = useState(false);
  // Add state variables for edit functionality
  const [editMode, setEditMode] = useState(false);
  const [currentClassroomId, setCurrentClassroomId] = useState<string | null>(null);
  // Add state for selected days of the week
  const [sessions, setSessions] = useState([
    { day: '', startTime: '', endTime: '' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error" | "info" | "warning">("success");
  const [copiedClassId, setCopiedClassId] = useState<string | null>(null);

  // Add this useEffect to handle client-side initialization
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Add this useEffect to handle body scroll locking
  useEffect(() => {
    if (isModalOpen) {
      // Lock scroll on both body and html
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.documentElement.style.overflow = 'hidden';
    } else {
      // Restore scroll
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.documentElement.style.overflow = '';
    }

    return () => {
      // Cleanup
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.documentElement.style.overflow = '';
    };
  }, [isModalOpen]);

  // Fetch instructor's classrooms
  const fetchClassrooms = async (uid: string) => {
    try {
      const q = query(
        collection(db, "classrooms"), 
        where("createdBy", "==", uid),
        where("isArchived", "==", showArchived)
      );
      const querySnapshot = await getDocs(q);
      const classroomList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setClassrooms(classroomList);
      await fetchActiveStudents(classroomList);
      await fetchStudentCounts(classroomList);
    } catch (error) {
      console.error("Error fetching classrooms:", error);
    }
  };

  // Add function to fetch active students count
  const fetchActiveStudents = async (classrooms: any[]) => {
    try {
      let totalStudents = 0;
      for (const classroom of classrooms) {
        // Get students enrolled in this classroom
        const studentsQuery = query(
          collection(db, "students"),
          where("classCode", "==", classroom.id)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        totalStudents += studentsSnapshot.size;
      }
      setActiveStudents(totalStudents);
    } catch (error) {
      console.error("Error fetching active students:", error);
    }
  };

  // Add function to fetch student counts for each classroom
  const fetchStudentCounts = async (classrooms: any[]) => {
    try {
      const counts: { [key: string]: number } = {};
      for (const classroom of classrooms) {
        const studentsQuery = query(
          collection(db, "students"),
          where("classCode", "==", classroom.id)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        counts[classroom.id] = studentsSnapshot.size;
      }
      setStudentCounts(counts);
    } catch (error) {
      console.error("Error fetching student counts:", error);
    }
  };

  // Add function to fetch attendance statistics
  const fetchAttendanceStats = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const attendanceQuery = query(
        collection(db, "attendance"),
        where("timestamp", ">=", today)
      );
      
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const stats = {
        present: 0,
        late: 0,
        excused: 0,
        absent: 0
      };

      attendanceSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.isLate) {
          // Check isLate flag first to properly count late attendance
          stats.late++;
        }
        else if (data.status === 'present') {
          stats.present++;
        }
        else if (data.status === 'excused') {
          stats.excused++;
        }
        else {
          stats.absent++;
        }
      });

      setAttendanceStats(stats);
    } catch (error) {
      console.error("Error fetching attendance stats:", error);
    }
  };

  // Add archive classroom function
  const handleArchiveClassroom = async (classroomId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent opening classroom when clicking archive
    try {
      const classroomRef = doc(db, "classrooms", classroomId);
      await updateDoc(classroomRef, {
        isArchived: true
      });
      // Refresh the classrooms list
      if (userId) fetchClassrooms(userId);
    } catch (error) {
      console.error("Error archiving classroom:", error);
    }
  };

  // Add unarchive classroom function
  const handleUnarchiveClassroom = async (classroomId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent opening classroom when clicking unarchive
    try {
      const classroomRef = doc(db, "classrooms", classroomId);
      await updateDoc(classroomRef, {
        isArchived: false
      });
      // Refresh the classrooms list
      if (userId) fetchClassrooms(userId);
    } catch (error) {
      console.error("Error unarchiving classroom:", error);
    }
  };

  // Add migration function for existing classrooms
  const migrateExistingClassrooms = async (uid: string) => {
    try {
      // Query all classrooms without isArchived field
      const q = query(
        collection(db, "classrooms"),
        where("createdBy", "==", uid)
      );
      const querySnapshot = await getDocs(q);
      
      // Update each classroom that doesn't have isArchived field
      const updates = querySnapshot.docs.map(async (doc) => {
        const data = doc.data();
        if (data.isArchived === undefined) {
          const classroomRef = doc.ref;
          await updateDoc(classroomRef, {
            isArchived: false
          });
        }
      });
      
      await Promise.all(updates);
    } catch (error) {
      console.error("Error migrating classrooms:", error);
    }
  };

  // Update the authentication useEffect
  useEffect(() => {
    if (!isClient) return; // Only run auth check on client

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
      } else {
        setUserId(user.uid);
        await migrateExistingClassrooms(user.uid); // Add migration step
        fetchClassrooms(user.uid);
        fetchAttendanceStats(); // Add this line
        setIsLoading(false); // Set loading to false after data is fetched
      }
    });

    return () => unsubscribe();
  }, [router, isClient]);

  useEffect(() => {
    if (userId) {
      fetchClassrooms(userId);
    }
  }, [userId, showArchived]); // Re-fetch when archive filter changes

  // Real-time pending excuse requests badge
  useEffect(() => {
    if (!userId) return;
    let unsubscribeClassrooms: (() => void) | null = null;
    let attendanceUnsubscribes: (() => void)[] = [];

    unsubscribeClassrooms = onSnapshot(
      query(collection(db, "classrooms"), where("createdBy", "==", userId)),
      (classSnapshot) => {
        // Clean up previous attendance listeners
        attendanceUnsubscribes.forEach(unsub => unsub());
        attendanceUnsubscribes = [];
        const classroomIds = classSnapshot.docs.map(doc => doc.id);
        if (classroomIds.length === 0) {
          setPendingRequests(0);
          return;
        }
        // Firestore 'in' queries support up to 10 items
        const chunks: string[][] = [];
        for (let i = 0; i < classroomIds.length; i += 10) {
          chunks.push(classroomIds.slice(i, i + 10));
        }
        let chunkCounts = new Array(chunks.length).fill(0);
        chunks.forEach((chunk, idx) => {
          const q = query(
            collection(db, "attendance"),
            where("status", "==", "excused"),
            where("classCode", "in", chunk)
          );
          const unsub = onSnapshot(q, (snap) => {
            chunkCounts[idx] = snap.docs.filter(doc => !doc.data().excuseStatus).length;
            setPendingRequests(chunkCounts.reduce((a, b) => a + b, 0));
          });
          attendanceUnsubscribes.push(unsub);
        });
      }
    );
    return () => {
      if (unsubscribeClassrooms) unsubscribeClassrooms();
      attendanceUnsubscribes.forEach(unsub => unsub());
    };
  }, [userId]);

  // Debug: log pendingRequests to see if it updates
  useEffect(() => {
    console.log('Pending Requests:', pendingRequests);
  }, [pendingRequests]);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  // Add this helper function at the top of your component
  const convertTo24Hour = (time: string): string | null => {
    // Remove all spaces and convert to uppercase
    const cleanTime = time.replace(/\s+/g, '').toUpperCase();
    
    // Try different formats
    const formats = [
      /^(1[0-2]|0?[1-9]):([0-5][0-9])(AM|PM)$/,  // 12:00AM, 1:00PM, etc.
      /^(1[0-2]|0?[1-9]):([0-5][0-9])\s*(AM|PM)$/,  // 12:00 AM, 1:00 PM
      /^(1[0-2]|0?[1-9])(AM|PM)$/,  // 12AM, 1PM
      /^(1[0-2]|0?[1-9])\s*(AM|PM)$/  // 12 AM, 1 PM
    ];

    for (const format of formats) {
      const match = cleanTime.match(format);
      if (match) {
        let hours = parseInt(match[1]);
        const minutes = match[2] ? match[2] : "00";
        const period = match[match.length - 1];

        // Convert to 24-hour format
        if (period === "PM" && hours !== 12) hours += 12;
        if (period === "AM" && hours === 12) hours = 0;

        return `${hours.toString().padStart(2, '0')}:${minutes}`;
      }
    }
    return null;
  };

  // Add this helper for day selection
  const daysOfWeek = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  ];

  const handleSessionChange = (idx: number, field: string, value: string) => {
    setSessions((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };
  const handleAddSession = () => {
    setSessions((prev) => [...prev, { day: '', startTime: '', endTime: '' }]);
  };
  const handleRemoveSession = (idx: number) => {
    setSessions((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  };

  // Handle Classroom Creation/Update
  const handleCreateClassroom = async () => {
    // Reset error state
    setError(null);
  
    // Validate required fields
    if (!classroomName.trim()) {
      setError("Classroom name is required.");
      return;
    }
  
    // Validate sessions
    for (const [i, session] of sessions.entries()) {
      if (!session.day || !session.startTime || !session.endTime) {
        setError(`Session ${i + 1}: All fields are required.`);
        return;
      }
      const start24 = convertTo24Hour(session.startTime);
      const end24 = convertTo24Hour(session.endTime);
      if (!start24 || !end24) {
        setError(`Session ${i + 1}: Invalid time format.`);
        return;
      }
      const [sh, sm] = start24.split(':').map(Number);
      const [eh, em] = end24.split(':').map(Number);
      if (sh > eh || (sh === eh && sm >= em)) {
        setError(`Session ${i + 1}: End time must be after start time.`);
        return;
      }
    }
    setIsSubmitting(true);
    try {
      if (!userId) {
        setError("User ID is missing. Please log in again.");
        setIsSubmitting(false);
        return;
      }
  
      // Create the classroom data object
      const classroomData = {
        name: classroomName,
        description: description,
        isArchived: false,
        sessions: sessions.map(s => ({
          day: s.day,
          startTime: s.startTime,
          endTime: s.endTime,
          startTime24: convertTo24Hour(s.startTime),
          endTime24: convertTo24Hour(s.endTime)
        }))
      };
  
      // Check if we're in edit mode or create mode
      if (editMode && currentClassroomId) {
        // Update existing classroom
        const classroomRef = doc(db, "classrooms", currentClassroomId);
        await updateDoc(classroomRef, classroomData);
      } else {
        // Create new classroom
        const newClassroomData = {
          ...classroomData,
          createdBy: userId,
          createdAt: new Date()
        };
        const docRef = await addDoc(collection(db, "classrooms"), newClassroomData);
        setCreatedClassroomId(docRef.id);
      }
  
      // Reset form and states
      setClassroomName("");
      setDescription("");
      setSessions([{ day: '', startTime: '', endTime: '' }]);
      setError(null);
      setOpenForm(false);
      setIsModalOpen(false);
      setEditMode(false); // Reset edit mode
      setCurrentClassroomId(null); // Reset current classroom ID
      
      // Refresh the classrooms list
      fetchClassrooms(userId);
    } catch (error) {
      console.error("Error with classroom:", error);
      setError(`Failed to ${editMode ? 'update' : 'create'} classroom. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update how you handle modal open/close
  const handleOpenModal = () => {
    // Reset form for new classroom creation
    setEditMode(false);
    setCurrentClassroomId(null);
    setClassroomName("");
    setDescription("");
    setSessions([{ day: '', startTime: '', endTime: '' }]);
    setIsModalOpen(true);
    setOpenForm(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setOpenForm(false);
  };

  const showSnackbar = (message: string, severity: "success" | "error" | "info" | "warning" = "success") => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  const copyClassCode = async (classroomId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent opening classroom when clicking copy button
    try {
      await navigator.clipboard.writeText(classroomId);
      setCopiedClassId(classroomId);
      showSnackbar("Class code copied to clipboard!");
      
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopiedClassId(null);
      }, 2000);
    } catch (err) {
      console.error("Failed to copy class code:", err);
      showSnackbar("Failed to copy class code", "error");
    }
  };

  return (
    <ClientSideWrapper>
      {isLoading && <LoadingOverlay isLoading={isLoading} message="Loading dashboard..." />}
      {navigating && <LoadingOverlay isLoading={navigating} message="Opening classroom..." />}
      <Box
        sx={{
          display: 'flex',
          minHeight: '100vh',
          bgcolor: '#f4f7fd' // changed from '#f8fafc' for a subtle blue-tinted background
        }}
      >
        {/* Sidebar */}
        <Box
          sx={{
            width: { xs: '70px', md: '220px' },
            bgcolor: '#f9fafb',
            borderRight: '1px solid #e5e7eb',
            position: 'fixed',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            py: 2,
            boxShadow: '0 2px 8px 0 rgba(51,78,172,0.04)',
          }}
        >
          {/* Logo */}
          <Box sx={{ px: 2, py: 2, mb: 3, display: 'flex', justifyContent: 'center' }}>
            <Box 
              component="img"
              src="/attendify.svg"
              alt="Attendify Logo"
              sx={{
                height: 40,
                width: 'auto',
                display: { xs: 'none', md: 'block' }
              }}
            />
            <Box 
              component="img"
              src="/favicon_io/android-chrome-192x192.png"
              alt="Attendify Logo"
              sx={{
                height: 32,
                width: 'auto',
                display: { xs: 'block', md: 'none' }
              }}
            />
          </Box>
          {/* Navigation Items */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, px: 1 }}>
            <Button
              startIcon={<HomeIcon />}
              sx={{
                justifyContent: 'flex-start',
                color: '#334eac',
                bgcolor: 'rgba(51, 78, 172, 0.07)',
                borderRadius: '8px',
                py: { xs: 1, md: 1.2 },
                px: { xs: 1.2, md: 1.7 },
                minWidth: 0,
                width: '100%',
                fontWeight: 500,
                fontSize: { xs: '1rem', md: '1.05rem' },
                '&:hover': { bgcolor: 'rgba(51, 78, 172, 0.13)' },
                '& .MuiButton-startIcon': {
                  margin: 0,
                  mr: { xs: 0, md: 1.5 },
                  minWidth: { xs: 22, md: 'auto' }
                }
              }}
            >
              <Typography
                sx={{
                  display: { xs: 'none', md: 'block' },
                  fontWeight: 500,
                  fontFamily: 'var(--font-gilroy)'
                }}
              >
                Classrooms
              </Typography>
            </Button>

            <Button
              startIcon={
                <Badge color="error" badgeContent={pendingRequests} invisible={false} sx={{ '& .MuiBadge-badge': { fontWeight: 600, fontSize: 13, minWidth: 20, height: 20 } }}>
                  <PeopleIcon />
                </Badge>
              }
              onClick={() => router.push('/student-requests')}
              sx={{
                justifyContent: 'flex-start',
                color: '#64748b',
                borderRadius: '8px',
                py: { xs: 1, md: 1.2 },
                px: { xs: 1.2, md: 1.7 },
                minWidth: 0,
                width: '100%',
                fontWeight: 500,
                fontSize: { xs: '1rem', md: '1.05rem' },
                '&:hover': { bgcolor: 'rgba(51, 78, 172, 0.07)' },
                '& .MuiButton-startIcon': {
                  margin: 0,
                  mr: { xs: 0, md: 1.5 },
                  minWidth: { xs: 22, md: 'auto' }
                }
              }}
            >
              <Typography
                sx={{
                  display: { xs: 'none', md: 'block' },
                  fontWeight: 500,
                  fontFamily: 'var(--font-gilroy)'
                }}
              >
                Student Requests
              </Typography>
            </Button>

            <Button
              startIcon={<DescriptionIcon />}
              onClick={() => router.push('/dashboard/reports')}
              sx={{
                justifyContent: 'flex-start',
                color: '#64748b',
                borderRadius: '8px',
                py: { xs: 1, md: 1.2 },
                px: { xs: 1.2, md: 1.7 },
                minWidth: 0,
                width: '100%',
                fontWeight: 500,
                fontSize: { xs: '1rem', md: '1.05rem' },
                '&:hover': { bgcolor: 'rgba(51, 78, 172, 0.07)' },
                '& .MuiButton-startIcon': {
                  margin: 0,
                  mr: { xs: 0, md: 1.5 },
                  minWidth: { xs: 22, md: 'auto' }
                }
              }}
            >
              <Typography
                sx={{
                  display: { xs: 'none', md: 'block' },
                  fontWeight: 500,
                  fontFamily: 'var(--font-gilroy)'
                }}
              >
                Reports
              </Typography>
            </Button>

            {/* Bottom Navigation Items */}
            <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                startIcon={<SettingsIcon />}
                sx={{
                  justifyContent: 'flex-start',
                  color: '#64748b',
                  borderRadius: '8px',
                  py: { xs: 1, md: 1.2 },
                  px: { xs: 1.2, md: 1.7 },
                  minWidth: 0,
                  width: '100%',
                  fontWeight: 500,
                  fontSize: { xs: '1rem', md: '1.05rem' },
                  '&:hover': { bgcolor: 'rgba(51, 78, 172, 0.07)' },
                  '& .MuiButton-startIcon': {
                    margin: 0,
                    mr: { xs: 0, md: 1.5 },
                    minWidth: { xs: 22, md: 'auto' }
                  }
                }}
              >
                <Typography
                  sx={{
                    display: { xs: 'none', md: 'block' },
                    fontWeight: 500,
                    fontFamily: 'var(--font-gilroy)'
                  }}
                >
                  Settings
                </Typography>
              </Button>

              <Button
                onClick={handleLogout}
                startIcon={<LogoutIcon />}
                sx={{
                  justifyContent: 'flex-start',
                  color: '#64748b',
                  borderRadius: '8px',
                  py: { xs: 1, md: 1.2 },
                  px: { xs: 1.2, md: 1.7 },
                  minWidth: 0,
                  width: '100%',
                  fontWeight: 500,
                  fontSize: { xs: '1rem', md: '1.05rem' },
                  '&:hover': { bgcolor: 'rgba(51, 78, 172, 0.07)' },
                  '& .MuiButton-startIcon': {
                    margin: 0,
                    mr: { xs: 0, md: 1.5 },
                    minWidth: { xs: 22, md: 'auto' }
                  }
                }}
              >
                <Typography
                  sx={{
                    display: { xs: 'none', md: 'block' },
                    fontWeight: 500,
                    fontFamily: 'var(--font-gilroy)'
                  }}
                >
                  Sign Out
                </Typography>
              </Button>
            </Box>
          </Box>

        </Box>

        {/* Main Content */}
        <Box
          sx={{
            flexGrow: 1,
            ml: { xs: '70px', md: '220px' },
            p: { xs: 2, sm: 3, md: 4 },
            width: '100%',
            minHeight: '100vh',
            bgcolor: '#f7fafd',
          }}
        >
          {/* Stats Section */}
          {isClient && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                gap: 3,
                mb: 4
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: '16px',
                  border: '1px solid rgba(0,0,0,0.08)',
                  bgcolor: 'white'
                }}
              >
                <Typography sx={{ color: '#64748b', mb: 1, fontSize: '0.875rem', fontFamily: 'var(--font-nunito)' }}>
                  Total Classrooms
                </Typography>
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 600, color: '#1e293b', fontFamily: 'var(--font-gilroy)' }}>
                  {classrooms.length}
                </Typography>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: '16px',
                  border: '1px solid rgba(0,0,0,0.08)',
                  bgcolor: 'white'
                }}
              >
                <Typography sx={{ color: '#64748b', mb: 1, fontSize: '0.875rem', fontFamily: 'var(--font-nunito)' }}>
                  Active Students
                </Typography>
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 600, color: '#1e293b', fontFamily: 'var(--font-gilroy)' }}>
                  {activeStudents}
                </Typography>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: '16px',
                  border: '1px solid rgba(0,0,0,0.08)',
                  bgcolor: 'white'
                }}
              >
                <Typography sx={{ color: '#64748b', mb: 1, fontSize: '0.875rem', fontFamily: 'var(--font-nunito)' }}>
                  Today's Attendance
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontSize: '1.5rem', fontWeight: 600, color: '#22c55e', fontFamily: 'var(--font-gilroy)' }}>
                      {attendanceStats.present}
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: '#64748b', fontFamily: 'var(--font-nunito)' }}>
                      Present
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '1.5rem', fontWeight: 600, color: '#eab308', fontFamily: 'var(--font-gilroy)' }}>
                      {attendanceStats.late}
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: '#64748b', fontFamily: 'var(--font-nunito)' }}>
                      Late
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '1.5rem', fontWeight: 600, color: '#eab308', fontFamily: 'var(--font-gilroy)' }}>
                      {attendanceStats.excused}
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: '#64748b', fontFamily: 'var(--font-nunito)' }}>
                      Excused
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '1.5rem', fontWeight: 600, color: '#ef4444', fontFamily: 'var(--font-gilroy)' }}>
                      {attendanceStats.absent}
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: '#64748b', fontFamily: 'var(--font-nunito)' }}>
                      Absent
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Add more stat cards as needed */}
            </Box>
          )}

          {/* Classroom Grid - Keep your existing classroom grid code here */}
          {isClient && (
            <>
              {/* Classroom Header with Archive Toggle */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography 
                  variant="h5" 
                  sx={{ 
                    fontWeight: 600, 
                    color: '#1e293b',
                    fontFamily: 'var(--font-gilroy)'
                  }}
                >
                  {showArchived ? 'Archived Classrooms' : 'Your Classrooms'}
                </Typography>
                <Button
                  onClick={() => setShowArchived(!showArchived)}
                  sx={{
                    textTransform: 'none',
                    color: '#64748b',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' }
                  }}
                >
                  {showArchived ? 'View Active Classrooms' : 'View Archived'}
                </Button>
              </Box>

              {/* Classroom Grid */}
              {classrooms.length === 0 ? (
                <Box
                  sx={{
                    textAlign: 'center',
                    py: { xs: 6, sm: 8 },
                    color: '#86868b'
                  }}
                >
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      mb: 2,
                      fontSize: { xs: '1rem', sm: '1.25rem' },
                      fontFamily: 'var(--font-gilroy)'
                    }}
                  >
                    No classrooms yet
                  </Typography>
                  <Typography 
                    variant="body1"
                    sx={{
                      fontSize: { xs: '0.875rem', sm: '1rem' },
                      fontFamily: 'var(--font-nunito)'
                    }}
                  >
                    Create your first classroom to get started
                  </Typography>
                </Box>
              ) : (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(auto-fill, minmax(280px, 1fr))",
                      md: "repeat(auto-fill, minmax(300px, 1fr))"
                    },
                    gap: { xs: 2, sm: 3, md: 4 },
                    px: { xs: 0, sm: 2 }
                  }}
                >
                  {classrooms.map((classroom) => (
                    <Paper
                      key={classroom.id}
                      elevation={0}
                      sx={{
                        p: { xs: 2.5, sm: 3 },
                        minHeight: { xs: "180px", sm: "200px" },
                        display: "flex",
                        flexDirection: "column",
                        borderRadius: '10px',
                        transition: "all 0.3s cubic-bezier(.4,0,.2,1)",
                        cursor: "pointer",
                        bgcolor: 'rgba(255,255,255,0.96)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 2px 8px 0 rgba(51,78,172,0.06)',
                        '&:hover': {
                          transform: { xs: 'scale(1.02)', sm: 'translateY(-4px)' },
                          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                          bgcolor: 'rgba(255,255,255,0.99)',
                        }
                      }}
                      onClick={() => {
                        setNavigating(true);
                        router.push(`/classroom/${classroom.id}`);
                      }}
                    >
                      <Box sx={{ mb: 'auto', position: 'relative' }}>
                        <Box sx={{ position: 'absolute', right: -8, top: -8, display: 'flex', zIndex: 2 }}>
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent opening classroom
                              setEditMode(true);
                              setCurrentClassroomId(classroom.id);
                              setClassroomName(classroom.name);
                              setDescription(classroom.description || "");
                              setSessions(classroom.sessions || [{ day: '', startTime: '', endTime: '' }]);
                              setOpenForm(true);
                              setIsModalOpen(true);
                            }}
                            sx={{
                              color: '#64748b',
                              mr: 1,
                              bgcolor: 'rgba(255,255,255,0.8)',
                              '&:hover': {
                                bgcolor: 'rgba(255,255,255,0.95)'
                              }
                            }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            onClick={(e) => showArchived 
                              ? handleUnarchiveClassroom(classroom.id, e)
                              : handleArchiveClassroom(classroom.id, e)}
                            sx={{
                              color: '#64748b',
                              bgcolor: 'rgba(255,255,255,0.8)',
                              '&:hover': {
                                bgcolor: 'rgba(255,255,255,0.95)'
                              }
                            }}
                          >
                            {showArchived ? <UnarchiveIcon /> : <ArchiveIcon />}
                          </IconButton>
                        </Box>
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 600,
                            fontSize: { xs: '1.1rem', sm: '1.2rem' },
                            color: '#1d1d1f',
                            mb: 1.5,
                            lineHeight: 1.2,
                            fontFamily: 'var(--font-gilroy)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 'calc(100% - 70px)',
                            pr: 1
                          }}
                        >
                          {classroom.name}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: '#86868b',
                            mb: 1,
                            lineHeight: 1.4,
                            fontSize: { xs: '0.875rem', sm: '0.875rem' },
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            fontFamily: 'var(--font-nunito)'
                          }}
                        >
                          {classroom.description || "No description provided"}
                        </Typography>
                      </Box>
                      <Box sx={{ mt: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              color: '#1e293b',
                              fontSize: { xs: '0.875rem', sm: '0.875rem' },
                              fontWeight: 500,
                              fontFamily: 'var(--font-nunito)',
                              mr: 1
                            }}
                          >
                            Class Code: 
                          </Typography>
                          <Tooltip 
                            title={copiedClassId === classroom.id ? "Copied!" : "Copy class code"}
                            placement="top"
                            arrow
                          >
                            <IconButton
                              size="small"
                              onClick={(e) => copyClassCode(classroom.id, e)}
                              sx={{
                                p: 0.5,
                                color: copiedClassId === classroom.id ? '#22c55e' : '#64748b',
                                '&:hover': { bgcolor: 'rgba(51, 78, 172, 0.08)' }
                              }}
                            >
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{
                            color: '#334eac', // schedule time color
                            mb: 2,
                            lineHeight: 1.4,
                            fontSize: { xs: '0.875rem', sm: '0.875rem' },
                            fontWeight: 500,
                            fontFamily: 'var(--font-nunito)'
                          }}
                        >
                          {classroom.sessions ? (
                            <>
                              Schedule:
                              {classroom.sessions.map((session: any, idx: number) => (
                                <span key={idx} style={{ display: 'block' }}>
                                  {session.day}: {session.startTime} - {session.endTime}
                                </span>
                              ))}
                            </>
                          ) : 'No schedule set'}
                        </Typography>
                        <Box 
                          sx={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            mt: 'auto',
                            pt: 1,
                            borderTop: '1px solid rgba(0,0,0,0.06)'
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography
                              variant="body2"
                              sx={{
                                color: '#64748b',
                                fontSize: { xs: '0.875rem', sm: '0.875rem' },
                                fontWeight: 500,
                                fontFamily: 'var(--font-nunito)'
                              }}
                            >
                              {studentCounts[classroom.id] || 0} student{studentCounts[classroom.id] !== 1 ? 's' : ''}
                            </Typography>
                          </Box>
                          <Button
                            variant="text"
                            sx={{
                              textTransform: "none",
                              color: '#334eac',
                              minWidth: 'auto',
                              p: 1,
                              fontFamily: 'var(--font-gilroy)',
                              fontWeight: 600,
                              '&:hover': {
                                bgcolor: 'rgba(51, 78, 172, 0.08)'
                              }
                            }}
                          >
                            Open →
                          </Button>
                        </Box>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}
            </>
          )}

          {/* Floating Add Classroom Button */}
          <Tooltip title="Create Classroom" arrow>
            <IconButton
              color="primary"
              sx={{
                position: "fixed",
                bottom: { xs: 24, sm: 32 },
                right: { xs: 24, sm: 32 },
                bgcolor: '#334eac',
                color: "white",
                width: { xs: 48, sm: 56 },
                height: { xs: 48, sm: 56 },
                transition: "all 0.2s ease",
                boxShadow: '0 4px 14px rgba(51,78,172,0.15)',
                '&:hover': {
                  bgcolor: '#22357a',
                  transform: 'scale(1.05)'
                }
              }}
              onClick={handleOpenModal}
            >
              <AddIcon sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }} />
            </IconButton>
          </Tooltip>

          {/* Create Classroom Modal */}
          <Modal
            open={openForm}
            onClose={handleCloseModal}
            closeAfterTransition
            disableScrollLock={false}
            disableEnforceFocus
            keepMounted
            slots={{ backdrop: Backdrop }}
            slotProps={{
              backdrop: {
                sx: {
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  backdropFilter: 'blur(4px)',
                  overflow: 'auto'
                }
              }
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'auto',
              padding: { xs: '16px 0', sm: 0 },
              '& .MuiBackdrop-root': {
                overflow: 'auto'
              }
            }}
          >
            <Paper
              elevation={0}
              sx={{
                width: { xs: '95%', sm: '480px' },
                p: { xs: 2.5, sm: 4 },
                borderRadius: { xs: '12px', sm: '16px' },
                bgcolor: 'rgba(255,255,255,0.98)',
                border: '1px solid #e5e7eb',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                maxHeight: { xs: '85vh', sm: '90vh' },
                overflowY: 'auto',
                position: 'relative',
                outline: 'none',
                mx: { xs: 1, sm: 2 },
                '&::-webkit-scrollbar': {
                  width: '8px'
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: 'rgba(0,0,0,0.1)',
                  borderRadius: '4px'
                }
              }}
            >
              <Typography 
                variant="h5" 
                sx={{ 
                  fontWeight: 600, 
                  color: '#1d1d1f',
                  mb: { xs: 2.5, sm: 3 },
                  fontSize: { xs: '1.25rem', sm: '1.5rem' },
                  fontFamily: 'var(--font-gilroy)'
                }}
              >
                {editMode ? 'Edit Classroom' : 'Create a Classroom'}
              </Typography>
    
              {error && (
                <Typography 
                  color="error" 
                  sx={{ 
                    mb: 2.5, 
                    fontFamily: 'var(--font-nunito)',
                    fontSize: { xs: '0.875rem', sm: '1rem' },
                    padding: { xs: '8px 12px', sm: 0 },
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    borderRadius: '8px',
                  }}
                >
                  {error}
                </Typography>
              )}
    
              <TextField
                label="Classroom Name"
                fullWidth
                variant="outlined"
                value={classroomName}
                onChange={(e) => setClassroomName(e.target.value)}
                sx={{
                  mb: { xs: 2.5, sm: 3 },
                  '& .MuiOutlinedInput-root': {
                    borderRadius: { xs: '8px', sm: '12px' },
                  },
                  '& .MuiInputLabel-root': {
                    fontSize: { xs: '0.9rem', sm: '1rem' },
                  },
                  '& .MuiOutlinedInput-input': {
                    padding: { xs: '12px 14px', sm: '16.5px 14px' },
                  }
                }}
              />
    
              <TextField
                label="Description (Optional)"
                fullWidth
                variant="outlined"
                multiline
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                sx={{
                  mb: { xs: 2.5, sm: 3 },
                  '& .MuiOutlinedInput-root': {
                    borderRadius: { xs: '8px', sm: '12px' },
                  },
                  '& .MuiInputLabel-root': {
                    fontSize: { xs: '0.9rem', sm: '1rem' },
                  }
                }}
              />

              <Box sx={{ mb: { xs: 2.5, sm: 3 } }}>
                <Typography sx={{ 
                    mb: { xs: 1.5, sm: 1 }, 
                    fontWeight: 500, 
                    fontFamily: 'var(--font-gilroy)',
                    fontSize: { xs: '0.95rem', sm: '1rem' }
                  }}
                >
                  Sessions
                </Typography>
                {sessions.map((session, idx) => (
                  <Box 
                    key={idx} 
                    sx={{ 
                      display: 'flex', 
                      flexDirection: { xs: 'column', sm: 'row' },
                      gap: { xs: 1.5, sm: 1 }, 
                      mb: 2.5,
                      pb: { xs: 2, sm: 0 },
                      borderBottom: { xs: idx < sessions.length - 1 ? '1px solid #f0f0f0' : 'none', sm: 'none' },
                      position: 'relative'
                    }}
                  >
                    <FormControl sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 110 } }}>
                      <InputLabel></InputLabel>
                      <TextField
                        select
                        label="Day"
                        value={session.day}
                        onChange={e => handleSessionChange(idx, 'day', e.target.value)}
                        SelectProps={{ native: true }}
                        variant="outlined"
                        sx={{ 
                          '& .MuiOutlinedInput-root': {
                            borderRadius: { xs: '8px', sm: '10px' },
                          }
                        }}
                      >
                        {daysOfWeek.map(day => <option key={day} value={day}>{day}</option>)}
                      </TextField>
                    </FormControl>
                    
                    <Box sx={{ 
                      display: 'flex', 
                      width: '100%',
                      flexDirection: { xs: 'row', sm: 'row' }, 
                      gap: 1,
                      alignItems: 'center'
                    }}>
                      <TextField
                        label="Start Time"
                        value={session.startTime}
                        onChange={e => handleSessionChange(idx, 'startTime', e.target.value)}
                        placeholder="e.g., 9:00 AM"
                        sx={{ 
                          flexGrow: 1,
                          '& .MuiOutlinedInput-root': {
                            borderRadius: { xs: '8px', sm: '10px' },
                          }
                        }}
                        variant="outlined"
                      />
                      <TextField
                        label="End Time"
                        value={session.endTime}
                        onChange={e => handleSessionChange(idx, 'endTime', e.target.value)}
                        placeholder="e.g., 10:00 AM"
                        sx={{ 
                          flexGrow: 1,
                          '& .MuiOutlinedInput-root': {
                            borderRadius: { xs: '8px', sm: '10px' },
                          }
                        }}
                        variant="outlined"
                      />
                    </Box>
                    
                    <Button 
                      onClick={() => handleRemoveSession(idx)} 
                      disabled={sessions.length === 1} 
                      color="error"
                      sx={{
                        alignSelf: { xs: 'flex-end', sm: 'center' },
                        minWidth: { xs: '80px', sm: 'auto' }
                      }}
                    >
                      Remove
                    </Button>
                  </Box>
                ))}
                <Button 
                  onClick={handleAddSession} 
                  sx={{ 
                    mt: 1,
                    fontFamily: 'var(--font-gilroy)', 
                    fontWeight: 600,
                    borderRadius: '8px',
                    '&:hover': {
                      bgcolor: 'rgba(51, 78, 172, 0.04)'
                    }
                  }}
                  startIcon={<AddIcon />}
                >
                  Add Session
                </Button>
              </Box>
    
              <Box 
                sx={{ 
                  display: "flex", 
                  flexDirection: { xs: 'column-reverse', sm: 'row' },
                  gap: { xs: 1.5, sm: 2 },
                  justifyContent: { xs: 'stretch', sm: 'flex-end' },
                  mt: { xs: 2, sm: 2 }
                }}
              >
                <Button
                  fullWidth={true}
                  onClick={handleCloseModal}
                  sx={{
                    textTransform: "none",
                    color: '#86868b',
                    borderRadius: { xs: '10px', sm: '12px' },
                    py: { xs: 1.2, sm: 1 },
                    '&:hover': {
                      bgcolor: 'rgba(0,0,0,0.05)'
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  fullWidth={true}
                  onClick={handleCreateClassroom}
                  disabled={isSubmitting}
                  sx={{
                    textTransform: "none",
                    bgcolor: '#334eac',
                    borderRadius: { xs: '10px', sm: '12px' },
                    py: { xs: 1.2, sm: 1 },
                    '&:hover': {
                      bgcolor: '#22357a'
                    }
                  }}
                >
                  {isSubmitting ? <CircularProgress size={24} color="inherit" sx={{ mr: 1 }} /> : null}
                  {editMode ? 'Update' : 'Create'}
                </Button>
              </Box>
            </Paper>
          </Modal>
        </Box>
      </Box>
      {isLoading && <LoadingOverlay isLoading={isLoading} message="Loading dashboard..." />}
      {/*navigating && <LoadingOverlay isLoading={navigating} message="Opening classroom..." />*/}
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbarSeverity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </ClientSideWrapper>
  );  
}
