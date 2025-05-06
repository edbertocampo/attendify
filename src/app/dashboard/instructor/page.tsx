"use client";

import { useState, useEffect } from "react";
import { Box, Paper, Typography, Button, TextField, AppBar, Toolbar, IconButton, Grid, Container, Modal, Backdrop, FormControl, InputLabel } from "@mui/material";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
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

// Create a wrapper component for client-side only rendering
const ClientSideWrapper = dynamic(() => Promise.resolve(({ children }: { children: React.ReactNode }) => <>{children}</>), {
  ssr: false
});

export default function InstructorDashboard() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [classroomName, setClassroomName] = useState("");
  const [description, setDescription] = useState("");
  const [createdClassroomId, setCreatedClassroomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
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

  // Handle Classroom Creation/Update
  const handleCreateClassroom = async () => {
    // Reset error state
    setError(null);
  
    // Validate required fields
    if (!classroomName.trim()) {
      setError("Classroom name is required.");
      return;
    }
  
    if (!startTime) {
      setError("Start time is required.");
      return;
    }
  
    if (!endTime) {
      setError("End time is required.");
      return;
    }
  
    // Convert times to 24-hour format
    const start24 = convertTo24Hour(startTime);
    const end24 = convertTo24Hour(endTime);
  
    if (!start24 || !end24) {
      setError("Please enter valid times (e.g., 9:00 AM, 2:30 PM)");
      return;
    }
  
    // Compare times
    const [startHour, startMinute] = start24.split(':').map(Number);
    const [endHour, endMinute] = end24.split(':').map(Number);
    
    if (startHour > endHour || (startHour === endHour && startMinute >= endMinute)) {
      setError("End time must be after start time.");
      return;
    }
  
    try {
      if (!userId) {
        setError("User ID is missing. Please log in again.");
        return;
      }
  
      // Create the classroom data object
      const classroomData = {
        name: classroomName,
        description: description,
        isArchived: false,
        schedule: {
          startTime: startTime.toUpperCase(), // Store the original 12-hour format
          endTime: endTime.toUpperCase(),
          startTime24: start24, // Store 24-hour format for calculations
          endTime24: end24
        }
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
      setStartTime("");
      setEndTime("");
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
    }
  };

  // Update how you handle modal open/close
  const handleOpenModal = () => {
    // Reset form for new classroom creation
    setEditMode(false);
    setCurrentClassroomId(null);
    setClassroomName("");
    setDescription("");
    setStartTime("");
    setEndTime("");
    setIsModalOpen(true);
    setOpenForm(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setOpenForm(false);
  };

  return (
    <ClientSideWrapper>
      {isLoading && <LoadingOverlay isLoading={isLoading} message="Loading dashboard..." />}
      <Box
        sx={{
          display: 'flex',
          minHeight: '100vh',
          bgcolor: '#f8fafc'
        }}
      >
        {/* Sidebar */}
        <Box
          sx={{
            width: { xs: '70px', md: '240px' },
            borderRight: '1px solid rgba(0,0,0,0.08)',
            bgcolor: 'white',
            position: 'fixed',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            py: 2
          }}
        >
          {/* Logo */}
          <Box sx={{ px: 3, py: 2, mb: 4 }}>
            <Typography
              sx={{
                fontSize: '1.5rem',
                fontWeight: 600,
                color: '#0066cc',
                display: { xs: 'none', md: 'block' }
              }}
            >
              Attendify
            </Typography>
            <Typography
              sx={{
                fontSize: '1.5rem',
                fontWeight: 600,
                color: '#0066cc',
                display: { xs: 'block', md: 'none' }
              }}
            >
              E
            </Typography>
          </Box>

          {/* Navigation Items */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, px: 2 }}>
            <Button
              startIcon={<HomeIcon />}
              sx={{
                justifyContent: 'flex-start',
                color: '#0066cc',
                bgcolor: 'rgba(0,102,204,0.08)',
                borderRadius: '10px',
                py: { xs: 1, md: 1.5 },
                px: { xs: 1.5, md: 2 },
                minWidth: 0,
                width: '100%',
                '&:hover': { bgcolor: 'rgba(0,102,204,0.12)' },
                '& .MuiButton-startIcon': { 
                  margin: 0,
                  mr: { xs: 0, md: 2 },
                  minWidth: { xs: 24, md: 'auto' }
                }
              }}
            >
              <Typography
                sx={{
                  display: { xs: 'none', md: 'block' },
                  fontWeight: 500
                }}
              >
                Classrooms
              </Typography>
            </Button>

            <Button
              startIcon={<PeopleIcon />}
              onClick={() => router.push('/student-requests')}
              sx={{
                justifyContent: 'flex-start',
                color: '#64748b',
                borderRadius: '10px',
                py: { xs: 1, md: 1.5 },
                px: { xs: 1.5, md: 2 },
                minWidth: 0,
                width: '100%',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
                '& .MuiButton-startIcon': { 
                  margin: 0,
                  mr: { xs: 0, md: 2 },
                  minWidth: { xs: 24, md: 'auto' }
                }
              }}
            >
              <Typography
                sx={{
                  display: { xs: 'none', md: 'block' },
                  fontWeight: 500
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
                borderRadius: '10px',
                py: { xs: 1, md: 1.5 },
                px: { xs: 1.5, md: 2 },
                minWidth: 0,
                width: '100%',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
                '& .MuiButton-startIcon': { 
                  margin: 0,
                  mr: { xs: 0, md: 2 },
                  minWidth: { xs: 24, md: 'auto' }
                }
              }}
            >
              <Typography
                sx={{
                  display: { xs: 'none', md: 'block' },
                  fontWeight: 500
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
                  borderRadius: '10px',
                  py: { xs: 1, md: 1.5 },
                  px: { xs: 1.5, md: 2 },
                  minWidth: 0,
                  width: '100%',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
                  '& .MuiButton-startIcon': { 
                    margin: 0,
                    mr: { xs: 0, md: 2 },
                    minWidth: { xs: 24, md: 'auto' }
                  }
                }}
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

              <Button
                onClick={handleLogout}
                startIcon={<LogoutIcon />}
                sx={{
                  justifyContent: 'flex-start',
                  color: '#64748b',
                  borderRadius: '10px',
                  py: { xs: 1, md: 1.5 },
                  px: { xs: 1.5, md: 2 },
                  minWidth: 0,
                  width: '100%',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
                  '& .MuiButton-startIcon': { 
                    margin: 0,
                    mr: { xs: 0, md: 2 },
                    minWidth: { xs: 24, md: 'auto' }
                  }
                }}
              >
                <Typography
                  sx={{
                    display: { xs: 'none', md: 'block' },
                    fontWeight: 500
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
            ml: { xs: '70px', md: '240px' },
            p: { xs: 2, sm: 3, md: 4 }
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
                <Typography sx={{ color: '#64748b', mb: 1, fontSize: '0.875rem' }}>
                  Total Classrooms
                </Typography>
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 600, color: '#1e293b' }}>
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
                <Typography sx={{ color: '#64748b', mb: 1, fontSize: '0.875rem' }}>
                  Active Students
                </Typography>
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 600, color: '#1e293b' }}>
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
                <Typography sx={{ color: '#64748b', mb: 1, fontSize: '0.875rem' }}>
                  Today's Attendance
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontSize: '1.5rem', fontWeight: 600, color: '#22c55e' }}>
                      {attendanceStats.present}
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: '#64748b' }}>
                      Present
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '1.5rem', fontWeight: 600, color: '#eab308' }}>
                      {attendanceStats.late}
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: '#64748b' }}>
                      Late
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '1.5rem', fontWeight: 600, color: '#eab308' }}>
                      {attendanceStats.excused}
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: '#64748b' }}>
                      Excused
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '1.5rem', fontWeight: 600, color: '#ef4444' }}>
                      {attendanceStats.absent}
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: '#64748b' }}>
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
                      fontSize: { xs: '1rem', sm: '1.25rem' }
                    }}
                  >
                    No classrooms yet
                  </Typography>
                  <Typography 
                    variant="body1"
                    sx={{
                      fontSize: { xs: '0.875rem', sm: '1rem' }
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
                        borderRadius: { xs: '12px', sm: '16px' },
                        transition: "all 0.3s ease",
                        cursor: "pointer",
                        bgcolor: 'rgba(255, 255, 255, 0.8)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        '&:hover': {
                          transform: { xs: 'scale(1.02)', sm: 'translateY(-4px)' },
                          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                          bgcolor: 'rgba(255, 255, 255, 0.9)',
                        }
                      }}
                      onClick={() => router.push(`/classroom/${classroom.id}`)}
                    >
                      <Box sx={{ mb: 'auto', position: 'relative' }}>
                        <Box sx={{ position: 'absolute', right: -8, top: -8, display: 'flex' }}>
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent opening classroom
                              setEditMode(true);
                              setCurrentClassroomId(classroom.id);
                              setClassroomName(classroom.name);
                              setDescription(classroom.description || "");
                              setStartTime(classroom.schedule?.startTime || "");
                              setEndTime(classroom.schedule?.endTime || "");
                              setOpenForm(true);
                              setIsModalOpen(true);
                            }}
                            sx={{
                              color: '#64748b',
                              mr: 1
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
                            lineHeight: 1.2
                          }}
                        >
                          {classroom.name}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: '#86868b',
                            mb: 2,
                            lineHeight: 1.4,
                            fontSize: { xs: '0.875rem', sm: '0.875rem' },
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {classroom.description || "No description provided"}
                        </Typography>
                      </Box>
                      <Box sx={{ mt: 2 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            color: '#06c',
                            mb: 2,
                            lineHeight: 1.4,
                            fontSize: { xs: '0.875rem', sm: '0.875rem' },
                            fontWeight: 500
                          }}
                        >
                          {classroom.schedule ? `${classroom.schedule.startTime} - ${classroom.schedule.endTime}` : 'No schedule set'}
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
                                fontWeight: 500
                              }}
                            >
                              {studentCounts[classroom.id] || 0} student{studentCounts[classroom.id] !== 1 ? 's' : ''}
                            </Typography>
                          </Box>
                          <Button
                            variant="text"
                            sx={{
                              textTransform: "none",
                              color: '#06c',
                              minWidth: 'auto',
                              p: 1,
                              '&:hover': {
                                bgcolor: 'rgba(0,102,204,0.08)'
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
                bgcolor: '#06c',
                color: "white",
                width: { xs: 48, sm: 56 },
                height: { xs: 48, sm: 56 },
                transition: "all 0.2s ease",
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                '&:hover': {
                  bgcolor: '#0055b3',
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
                  overflow: 'hidden'
                }
              }
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              '& .MuiBackdrop-root': {
                overflow: 'hidden'
              }
            }}
          >
            <Paper
              elevation={0}
              sx={{
                width: { xs: '90%', sm: '480px' },
                p: { xs: 3, sm: 4 },
                borderRadius: { xs: '16px', sm: '20px' },
                bgcolor: 'rgba(255, 255, 255, 0.98)',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                maxHeight: '90vh',
                overflowY: 'auto',
                position: 'relative',
                outline: 'none',
                mx: 2,
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
                  mb: 3,
                  fontSize: { xs: '1.25rem', sm: '1.5rem' }
                }}
              >
                {editMode ? 'Edit Classroom' : 'Create a Classroom'}
              </Typography>
    
              {error && (
                <Typography color="error" sx={{ mb: 2 }}>
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
                  mb: 3,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: { xs: '10px', sm: '12px' },
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
                  mb: 3,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: { xs: '10px', sm: '12px' },
                  }
                }}
              />

              <Box sx={{ 
                display: 'flex', 
                gap: 2, 
                mb: 3,
                flexDirection: { xs: 'column', sm: 'row' }
              }}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <TextField
                    required
                    label="Start Time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    placeholder="e.g., 9:00 AM"
                    helperText="Enter time in 12-hour format (e.g., 9:00 AM)"
                    fullWidth
                  />
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <TextField
                    required
                    label="End Time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    placeholder="e.g., 10:00 AM"
                    helperText="Enter time in 12-hour format (e.g., 10:00 AM)"
                    fullWidth
                  />
                </FormControl>
              </Box>
    
              <Box 
                sx={{ 
                  display: "flex", 
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: 2,
                  justifyContent: { xs: 'stretch', sm: 'flex-end' }
                }}
              >
                <Button
                  variant="contained"
                  fullWidth={true}
                  onClick={handleCreateClassroom}
                  sx={{
                    textTransform: "none",
                    bgcolor: '#06c',
                    borderRadius: { xs: '10px', sm: '12px' },
                    py: { xs: 1.5, sm: 1 },
                    order: { xs: 1, sm: 0 },
                    '&:hover': {
                      bgcolor: '#0055b3'
                    }
                  }}
                >
                  {editMode ? 'Update' : 'Create'}
                </Button>
                <Button
                  fullWidth={true}
                  onClick={handleCloseModal}
                  sx={{
                    textTransform: "none",
                    color: '#86868b',
                    order: { xs: 2, sm: 0 },
                    '&:hover': {
                      bgcolor: 'rgba(0,0,0,0.05)'
                    }
                  }}
                >
                  Cancel
                </Button>
              </Box>
            </Paper>
          </Modal>
        </Box>
      </Box>
      {isLoading && <LoadingOverlay isLoading={isLoading} message="Loading dashboard..." />}
    </ClientSideWrapper>
  );  
}
