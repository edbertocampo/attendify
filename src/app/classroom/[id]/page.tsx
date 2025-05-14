"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "../../../lib/firebase";
import { collection, getDocs, query, where, updateDoc, doc, deleteDoc, addDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { 
  Box, Typography, IconButton, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Paper, Tooltip, CircularProgress, 
  MenuItem, Select, Avatar, Card, Grid, Container, Button, Chip,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Divider, Alert, Snackbar, TextField, InputAdornment, Fade,
  FormControl, InputLabel, Menu, ListItemIcon, ListItemText,
  ToggleButtonGroup, ToggleButton, Badge, useMediaQuery, useTheme,
  Checkbox, Modal
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PersonIcon from "@mui/icons-material/Person";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LogoutIcon from "@mui/icons-material/Logout";
import SearchIcon from "@mui/icons-material/Search";
import SchoolIcon from "@mui/icons-material/School";
import GroupIcon from "@mui/icons-material/Group";
import SortIcon from "@mui/icons-material/Sort";
import RefreshIcon from "@mui/icons-material/Refresh";
import FilterListIcon from "@mui/icons-material/FilterList";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DownloadIcon from "@mui/icons-material/Download";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import CloseIcon from "@mui/icons-material/Close";
import LoadingOverlay from "../../../components/LoadingOverlay";
import AttendanceCalendar from '../../../components/AttendanceCalendar';
import dayjs from 'dayjs';

interface Student {
  id: string;
  studentId?: string; // This is the actual Firebase user ID
  fullName: string;
  statusId: string;
  email?: string;
  lastAttendance?: string;
  profileImage?: string;
  attendancePercentage?: number;
  absenceCount?: number;
  selected?: boolean;
}

interface AttendanceEntry {
  date: string; // Format: 'YYYY-MM-DD'
  type: 'image' | 'file';
  url: string;
  fileName?: string;
  geolocation?: { latitude: number; longitude: number } | null;
}

const ClassroomPage = () => {
  const params = useParams();
  const router = useRouter();
  const { id } = params;
  const classCode = Array.isArray(id) ? id[0] : id;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [classroomName, setClassroomName] = useState<string>("");
  const [classroomId, setClassroomId] = useState<string>("");
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error" | "info" | "warning">("success");
  const [confirmDialogOpen, setConfirmDialogOpen] = useState<boolean>(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [action, setAction] = useState<"remove" | "drop" | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "enrolled" | "dropped">("all");
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [attendanceMode, setAttendanceMode] = useState<boolean>(false);
  const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null);
  const [takingAttendance, setTakingAttendance] = useState<boolean>(false);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [calendarStudent, setCalendarStudent] = useState<Student | null>(null);
  const [calendarEntries, setCalendarEntries] = useState<AttendanceEntry[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarYear, setCalendarYear] = useState(dayjs().year());
  const [calendarMonth, setCalendarMonth] = useState(dayjs().month() + 1); // dayjs month is 0-based

  useEffect(() => {
    if (!classCode) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch classroom details
        const classroomsQuery = query(collection(db, "classrooms"), where("classCode", "==", classCode));
        const classroomSnapshot = await getDocs(classroomsQuery);
        
        if (!classroomSnapshot.empty) {
          const classroomDoc = classroomSnapshot.docs[0];
          const classroomData = classroomDoc.data();
          console.log("Retrieved classroom data:", classroomData);
          
          // Make sure to use the right field from your Firestore document
          setClassroomName(classroomData.name || "Unnamed Classroom");
          setClassroomId(classroomDoc.id);
        } else {
          console.log("No classroom found with classCode:", classCode);
          
          // If no classroom found with classCode, try to find by document ID
          try {
            const classroomDocRef = doc(db, "classrooms", classCode);
            const classroomDocSnap = await getDoc(classroomDocRef);
            
            if (classroomDocSnap.exists()) {
              const classroomData = classroomDocSnap.data();
              console.log("Retrieved classroom by ID:", classroomData);
              setClassroomName(classroomData.name || "Unnamed Classroom");
              setClassroomId(classroomDocSnap.id);
            } else {
              console.log("Classroom document does not exist");
            }
          } catch (error) {
            console.error("Error fetching classroom by ID:", error);
          }
        }

        // Fetch students
        const studentsQuery = query(collection(db, "students"), where("classCode", "==", classCode));
        const querySnapshot = await getDocs(studentsQuery);
        
        // Fetch all users to get email information
        const usersQuery = query(collection(db, "users"));
        const usersSnapshot = await getDocs(usersQuery);
        const usersMap = new Map();
        usersSnapshot.docs.forEach(doc => {
          usersMap.set(doc.id, doc.data());
        });
        
        // Fetch attendance records to calculate attendance percentage
        const attendanceQuery = query(collection(db, "attendance"), where("classCode", "==", classCode));
        const attendanceSnapshot = await getDocs(attendanceQuery);
        
        const attendanceRecords = attendanceSnapshot.docs.map(doc => doc.data());
        
        const studentsData = querySnapshot.docs.map((doc) => {
          const studentData = doc.data();
          
          // Calculate attendance percentage
          const studentAttendance = attendanceRecords.filter(record => 
            record.studentId === doc.id
          );
          
          const attendancePercentage = studentAttendance.length > 0 
            ? (studentAttendance.filter(record => record.present).length / studentAttendance.length) * 100
            : 0;
          
          // Count absences (present === false)
          const absenceCount = studentAttendance.filter(record => record.present === false).length;
          
          // Get user information using studentId which maps to user's id
          const userData = usersMap.get(studentData.studentId);
            return {
            id: doc.id,
            studentId: studentData.studentId, // Add the actual studentId from Firestore
            fullName: studentData.fullName || "Unknown",
            statusId: studentData.statusId || "1", // Default to "Enrolled"
            email: userData?.email || "No email provided",
            lastAttendance: studentData.lastAttendance || "",
            profileImage: studentData.profileImage || "",
            attendancePercentage: Math.round(attendancePercentage),
            absenceCount, // <-- add absence count
            selected: false
          };
        });

        setStudents(studentsData);
      } catch (error) {
        console.error("Error fetching data:", error);
        showSnackbar("Error loading classroom data", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [classCode, refreshing]);

  const showSnackbar = (message: string, severity: "success" | "error" | "info" | "warning" = "success") => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  const handleConfirmAction = () => {
    if (!selectedStudentId) return;
    
    if (action === "remove") {
      handleRemoveStudent(selectedStudentId);
    } else if (action === "drop") {
      handleUpdateStatus(selectedStudentId, "2");
    }
    
    setConfirmDialogOpen(false);
    setSelectedStudentId(null);
    setAction(null);
  };

  const openConfirmDialog = (studentId: string, actionType: "remove" | "drop") => {
    setSelectedStudentId(studentId);
    setAction(actionType);
    setConfirmDialogOpen(true);
  };

  const handleRefresh = () => {
    setRefreshing(prev => !prev);
    showSnackbar("Refreshing classroom data...", "info");
  };

  const copyClassCode = async () => {
    if (classCode) {
      try {
        await navigator.clipboard.writeText(classCode);
        showSnackbar("Class code copied to clipboard!");
      } catch (err) {
        console.error("Failed to copy class code:", err);
        showSnackbar("Failed to copy class code", "error");
      }
    }
  };

  const handleUpdateStatus = async (studentId: string, newStatusId: string) => {
    try {
      const studentRef = doc(db, "students", studentId);
      await updateDoc(studentRef, { statusId: newStatusId });

      setStudents((prevStudents) =>
        prevStudents.map((student) =>
          student.id === studentId ? { ...student, statusId: newStatusId } : student
        )
      );
      
      showSnackbar(newStatusId === "1" ? "Student enrolled successfully" : "Student marked as dropped");
    } catch (error) {
      console.error("Error updating status:", error);
      showSnackbar("Failed to update student status", "error");
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    try {
      await deleteDoc(doc(db, "students", studentId));
      setStudents((prevStudents) => prevStudents.filter((student) => student.id !== studentId));
      showSnackbar("Student removed successfully");
    } catch (error) {
      console.error("Error removing student:", error);
      showSnackbar("Failed to remove student", "error");
    }
  };

  const openExportMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setExportAnchorEl(event.currentTarget);
  };

  const closeExportMenu = () => {
    setExportAnchorEl(null);
  };

  const exportData = (format: "csv" | "pdf") => {
    closeExportMenu();
    
    if (format === "csv") {
      // Generate CSV
      const headers = "Student Name,Email,Status,Attendance %\n";
      const csvContent = students.map(student => 
        `"${student.fullName}","${student.email || ''}","${student.statusId === '1' ? 'Enrolled' : 'Dropped'}","${student.attendancePercentage || 0}%"` 
      ).join("\n");
      
      const csvBlob = new Blob([headers + csvContent], { type: "text/csv" });
      const csvUrl = URL.createObjectURL(csvBlob);
      const link = document.createElement("a");
      
      link.href = csvUrl;
      link.download = `${classroomName.replace(/\s+/g, '-')}_students.csv`;
      link.click();
      
      showSnackbar("CSV file downloaded successfully");
    } else {
      // For PDF, we would typically use a library like jsPDF
      // This is a simplified implementation
      showSnackbar("PDF export feature coming soon", "info");
    }
  };

  const handleToggleAttendanceMode = () => {
    if (attendanceMode) {
      // Reset all selections when exiting attendance mode
      setStudents(students.map(student => ({...student, selected: false})));
    }
    setAttendanceMode(!attendanceMode);
  };

  const handleSelectStudent = (studentId: string) => {
    if (!attendanceMode) return;
    
    setStudents(students.map(student => 
      student.id === studentId ? {...student, selected: !student.selected} : student
    ));
  };

  const handleSelectAllStudents = () => {
    // Only select enrolled students
    const allSelected = students
      .filter(student => student.statusId === "1")
      .every(student => student.selected);
    
    setStudents(students.map(student => 
      student.statusId === "1" ? {...student, selected: !allSelected} : student
    ));
  };

  const handleSubmitAttendance = async () => {
    setTakingAttendance(true);
    try {
      const timestamp = serverTimestamp();
      const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Create attendance records for all students
      for (const student of students) {
        if (student.statusId === "1") { // Only for enrolled students
          await addDoc(collection(db, "attendance"), {
            classCode,
            classroomId,
            studentId: student.id,
            studentName: student.fullName,
            date: currentDate,
            timestamp,
            present: !!student.selected,
          });
          
          // Update last attendance date for selected students
          if (student.selected) {
            await updateDoc(doc(db, "students", student.id), {
              lastAttendance: currentDate
            });
          }
        }
      }
      
      showSnackbar("Attendance recorded successfully");
      setAttendanceMode(false);
      // Reset selections
      setStudents(students.map(student => ({...student, selected: false})));
      // Refresh to get updated data
      setRefreshing(prev => !prev);
    } catch (error) {
      console.error("Error recording attendance:", error);
      showSnackbar("Failed to record attendance", "error");
    } finally {
      setTakingAttendance(false);
    }
  };

  const handleCameraAttendance = () => {
    if (!classCode) return;
    // Navigate to camera attendance page with class code
    router.push(`/dashboard/student/class/${classCode}`);
  };
  const handleOpenCalendar = async (student: Student) => {
    console.log('Opening calendar for student:', student);
    setCalendarStudent(student);
    setCalendarModalOpen(true);
    setCalendarLoading(true);
    setCalendarYear(dayjs().year());
    setCalendarMonth(dayjs().month() + 1);
    try {
      // Fetch attendance records for this student      // Use the studentId field that references the Firebase user ID, not the document ID
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('classCode', '==', classCode),
        where('studentId', '==', student.studentId || student.id) // Prefer studentId if available
      );
      console.log('Fetching attendance records with query:', { classCode, studentId: student.id });      const snapshot = await getDocs(attendanceQuery);
      console.log(`Found ${snapshot.docs.length} attendance records for student:`, student.id);
      
      // Group by date, and allow both image and file for the same date
      const dateMap: Record<string, AttendanceEntry> = {};
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        console.log('Attendance record:', { id: docSnap.id, ...data });
        
        // Make sure we have a valid timestamp and format it correctly as YYYY-MM-DD
        let date = '';
        if (data.timestamp) {
          if (data.timestamp.toDate) {
            // Firebase Timestamp - convert to Date then to string
            date = data.timestamp.toDate().toISOString().slice(0, 10);
          } else if (data.timestamp instanceof Date) {
            // Regular Date object
            date = data.timestamp.toISOString().slice(0, 10);
          } else if (typeof data.timestamp === 'string') {
            // String timestamp - extract date portion
            date = data.timestamp.slice(0, 10);
          }
        }
        
        console.log(`Record date: ${date}, Has proof image: ${!!data.proofImage}, Has excuse file: ${!!data.excuseFile}`);
        if (!date) return;
        
        if (data.proofImage) {
          dateMap[date] = {
            date,
            type: 'image',
            url: data.proofImage,
            geolocation: data.geolocation || null,
          };
        }
          // Check if there's an excuse file
        if (data.excuseFile) {
          console.log('Found excuse file:', data.excuseFile, typeof data.excuseFile);
          // If there's already an image for this date, add a file entry for the same date
          if (dateMap[date] && dateMap[date].type === 'image') {
            // Add a second entry for the file (calendar only shows one per day, so prefer image, but can be extended)
            // For now, prefer image, but if we want to show both, we could extend AttendanceCalendar to support multiple entries per day
            console.log('Already have an image for this date, preferring it over file');          } else {
            // Format file URL consistently
            let fileUrl = data.excuseFile;
            console.log('Processing file URL:', fileUrl);
            
            // Make sure file URLs are properly formatted
            if (typeof fileUrl === 'string') {
              // For MongoDB URLs (they have a specific format - /api/files/...)
              if (fileUrl.includes('/api/files/') || fileUrl.includes('/api/upload/')) {
                // These are already correct relative paths, just ensure they start with /
                if (!fileUrl.startsWith('/')) {
                  fileUrl = '/' + fileUrl;
                }
                console.log('MongoDB file URL:', fileUrl);
              } 
              // For other URLs that aren't absolute
              else if (!fileUrl.startsWith('http') && !fileUrl.startsWith('/')) {
                fileUrl = '/' + fileUrl;
                console.log('Fixed file path to:', fileUrl);
              }
            }
              
            dateMap[date] = {
              date,
              type: 'file',
              url: fileUrl,
              fileName: typeof data.excuseFile === 'string' ? data.excuseFile.split('/').pop() : undefined,
              geolocation: data.geolocation || null,
            };
          }
        }      });
      const entries = Object.values(dateMap);
      console.log('Calendar entries constructed:', entries);
      console.log('Entries with files:', entries.filter(e => e.type === 'file'));
      
      setCalendarEntries(entries);
    } catch (e) {
      console.error('Error fetching attendance records:', e);
      setCalendarEntries([]);
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleCloseCalendar = () => {
    setCalendarModalOpen(false);
    setCalendarStudent(null);
    setCalendarEntries([]);
  };

  // Filter and sort students for display
  const filteredStudents = students.filter(student => {
    // Apply name filter
    const nameMatch = student.fullName.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Apply status filter
    let statusMatch = true;
    if (statusFilter === "enrolled") {
      statusMatch = student.statusId === "1";
    } else if (statusFilter === "dropped") {
      statusMatch = student.statusId === "2";
    }
    
    return nameMatch && statusMatch;
  });

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    const nameA = a.fullName.toLowerCase();
    const nameB = b.fullName.toLowerCase();
    return sortOrder === "asc" 
      ? nameA.localeCompare(nameB)
      : nameB.localeCompare(nameA);
  });

  // Get enrollment stats
  const enrolledCount = students.filter(s => s.statusId === "1").length;
  const droppedCount = students.filter(s => s.statusId === "2").length;
  const selectedCount = students.filter(s => s.selected).length;
    return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f8faff", pb: 8 }}>
      {(loading || takingAttendance) && 
        <LoadingOverlay isLoading={true} message={takingAttendance ? "Recording attendance..." : "Loading classroom data..."} />
      }
        {/* Modern App Bar */}
      <Box 
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          px: { xs: 2, sm: 4 },
          py: 1.5,
          bgcolor: "#FFFFFF",
          color: "#334eac",
          boxShadow: "0 2px 20px rgba(0, 0, 0, 0.08)",
          zIndex: 1100,
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(0, 0, 0, 0.05)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Tooltip title="Back to Dashboard" arrow>
            <IconButton 
              onClick={() => window.history.back()} 
              sx={{ 
                mr: 1.5, 
                color: "#334eac", 
                backgroundColor: "rgba(51, 78, 172, 0.08)",
                '&:hover': { backgroundColor: "rgba(51, 78, 172, 0.15)" }
              }}
            >
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Avatar 
              sx={{ 
                bgcolor: "#334eac", 
                width: 38, 
                height: 38, 
                mr: 1.5,
                display: { xs: 'none', sm: 'flex' }
              }}
            >
              <SchoolIcon sx={{ fontSize: 22 }} />
            </Avatar>
            <Typography 
              variant="h6" 
              fontWeight="600" 
              noWrap
              sx={{ 
                fontFamily: "var(--font-gilroy)",
                fontSize: { xs: '1.1rem', sm: '1.2rem' },
                color: "#1e293b" 
              }}
            >
              {classroomName || "Classroom"}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", gap: { xs: 0.5, sm: 1 } }}>
          <Tooltip title="Refresh Data" arrow>
            <IconButton 
              onClick={handleRefresh}
              sx={{ 
                color: "#64748b", 
                '&:hover': { 
                  color: "#334eac",
                  backgroundColor: "rgba(51, 78, 172, 0.08)"
                }
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Logout" arrow>
            <IconButton 
              onClick={() => alert("Logging out...")} 
              sx={{ 
                color: "#64748b", 
                '&:hover': { 
                  color: "#334eac",
                  backgroundColor: "rgba(51, 78, 172, 0.08)"
                }
              }}
            >
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>      {/* Main Content */}
      <Container maxWidth="lg" sx={{ mt: 8, pt: 2 }}>
        {/* Classroom Info Card */}
        <Card 
          elevation={0} 
          sx={{ 
            mb: 4, 
            borderRadius: 3,
            p: { xs: 3, sm: 4 },
            background: "linear-gradient(135deg, #334eac 0%, #4c63cf 100%)",
            color: "white",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 10px 30px rgba(51, 78, 172, 0.15)"
          }}
        >
          <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 3 }}>
            <Box sx={{ flex: 1 }}>
              <Typography 
                variant="h4" 
                fontWeight="700" 
                gutterBottom
                sx={{ 
                  fontFamily: "var(--font-gilroy)",
                  fontSize: { xs: "1.75rem", sm: "2rem", md: "2.25rem" }
                }}
              >
                {classroomName || "Unnamed Classroom"}
              </Typography>
              
              <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
                <Typography variant="body1" sx={{ mr: 2, fontFamily: "var(--font-nunito)" }}>
                  Class Code: 
                </Typography>
                <Tooltip title="Copy class code" arrow>
                  <Button 
                    variant="outlined"
                    startIcon={<ContentCopyIcon />}
                    onClick={copyClassCode}
                    sx={{ 
                      color: "white",
                      borderColor: "rgba(255,255,255,0.3)",
                      textTransform: "none",
                      bgcolor: "rgba(255,255,255,0.1)",
                      fontFamily: "var(--font-nunito)",
                      pl: 2,
                      pr: 2.5,
                      py: 0.75,
                      '&:hover': { 
                        bgcolor: "rgba(255,255,255,0.2)",
                        borderColor: "rgba(255,255,255,0.5)"
                      }
                    }}
                  >
                    {classCode}
                  </Button>
                </Tooltip>
              </Box>
            </Box>
            
            <Box sx={{ 
              display: "flex", 
              bgcolor: "rgba(255,255,255,0.1)",
              borderRadius: 2,
              p: { xs: 2, sm: 3 },
              border: "1px solid rgba(255,255,255,0.15)",
              justifyContent: { xs: "space-between", sm: "space-between" }, 
              mt: { xs: 2, sm: 0 } 
            }}>
              <Box sx={{ textAlign: "center", px: { xs: 1, sm: 2 } }}>
                <Avatar sx={{ 
                  bgcolor: "rgba(255,255,255,0.2)", 
                  color: "white",
                  width: 48, 
                  height: 48, 
                  mb: 1,
                  mx: "auto"
                }}>
                  <GroupIcon />
                </Avatar>
                <Typography variant="h5" fontWeight="700" sx={{ fontFamily: "var(--font-gilroy)" }}>
                  {students.length}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8, fontFamily: "var(--font-nunito)" }}>
                  Total Students
                </Typography>
              </Box>
              
              <Box sx={{ textAlign: "center", px: { xs: 1, sm: 2 } }}>
                <Avatar sx={{ 
                  bgcolor: "rgba(34, 197, 94, 0.2)", 
                  color: "#4ade80",
                  width: 48, 
                  height: 48, 
                  mb: 1,
                  mx: "auto"
                }}>
                  <CheckCircleIcon />
                </Avatar>
                <Typography variant="h5" fontWeight="700" sx={{ color: "#4ade80", fontFamily: "var(--font-gilroy)" }}>
                  {enrolledCount}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8, fontFamily: "var(--font-nunito)" }}>
                  Enrolled
                </Typography>
              </Box>
              
              <Box sx={{ textAlign: "center", px: { xs: 1, sm: 2 } }}>
                <Avatar sx={{ 
                  bgcolor: "rgba(239, 68, 68, 0.2)", 
                  color: "#f87171",
                  width: 48, 
                  height: 48, 
                  mb: 1,
                  mx: "auto"
                }}>
                  <PersonIcon />
                </Avatar>
                <Typography variant="h5" fontWeight="700" sx={{ color: "#f87171", fontFamily: "var(--font-gilroy)" }}>
                  {droppedCount}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8, fontFamily: "var(--font-nunito)" }}>
                  Dropped
                </Typography>
              </Box>
            </Box>
          </Box>
          
          {/* Quick Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, mt: 4, flexWrap: 'wrap' }}>
            <Button
              variant={attendanceMode ? "outlined" : "contained"}
              size="medium"
              startIcon={attendanceMode ? <CloseIcon /> : <CheckCircleIcon />}
              onClick={handleToggleAttendanceMode}
              sx={{
                bgcolor: attendanceMode ? "transparent" : "white",
                color: attendanceMode ? "#f87171" : "#334eac",
                borderColor: attendanceMode ? "#f87171" : "transparent",
                borderWidth: 2,
                textTransform: "none",
                fontWeight: 600,
                px: 3,
                py: 1,
                fontFamily: "var(--font-nunito)",
                borderRadius: 2,
                '&:hover': { 
                  bgcolor: attendanceMode ? "rgba(239, 68, 68, 0.1)" : "rgba(255,255,255,0.9)",
                  borderColor: attendanceMode ? "#f87171" : "transparent",
                }
              }}
            >
              {attendanceMode ? "Cancel Attendance" : "Take Attendance"}
            </Button>
          </Box>
        </Card>        {/* Student Management Section */}
        <Card 
          elevation={0} 
          sx={{ 
            borderRadius: 3,
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.03)"
          }}
        >
          <Box sx={{ 
            p: { xs: 2.5, sm: 3 }, 
            borderBottom: "1px solid rgba(0,0,0,0.06)", 
            bgcolor: "#ffffff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12
          }}>
            <Typography 
              variant="h6" 
              fontWeight="600" 
              sx={{ 
                my: 1, 
                color: "#1e293b",
                fontFamily: "var(--font-gilroy)",
                fontSize: { xs: '1.1rem', sm: '1.2rem' }
              }}
            >
              {attendanceMode ? (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CheckBoxIcon sx={{ mr: 1, color: "#334eac" }} />
                  Take Attendance 
                  <Chip 
                    label={`${selectedCount} selected`} 
                    size="small" 
                    sx={{ 
                      ml: 1.5,
                      bgcolor: selectedCount > 0 ? 'rgba(51, 78, 172, 0.1)' : 'rgba(0,0,0,0.05)', 
                      color: selectedCount > 0 ? '#334eac' : '#64748b',
                      fontWeight: 600,
                      borderRadius: '6px'
                    }} 
                  />
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <GroupIcon sx={{ mr: 1.5, color: "#334eac", fontSize: 20 }} />
                  Student Management
                </Box>
              )}
            </Typography>
            
            {attendanceMode && (
              <Button
                variant="contained"
                disabled={takingAttendance}
                onClick={handleSubmitAttendance}
                startIcon={<CheckBoxIcon />}
                sx={{
                  bgcolor: "#334eac",
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 2,
                  px: 2.5,
                  fontFamily: "var(--font-nunito)",
                  '&:hover': {
                    bgcolor: "#22357a"
                  },
                  '&.Mui-disabled': {
                    bgcolor: "rgba(51, 78, 172, 0.5)",
                    color: "white"
                  }
                }}
              >
                Submit Attendance
              </Button>
            )}
          </Box>
            {/* Search and Filter Bar */}
          <Box sx={{ 
            p: { xs: 2, sm: 3 }, 
            display: "flex", 
            alignItems: "center", 
            flexWrap: "wrap", 
            gap: 2,
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            bgcolor: "rgba(247, 250, 253, 0.5)"
          }}>
            <TextField
              placeholder="Search students..."
              variant="outlined"
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: "#64748b" }} />
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: 2,
                  backgroundColor: "#ffffff",
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(0,0,0,0.08)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(51, 78, 172, 0.2)',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#334eac',
                  },
                }
              }}
              sx={{ 
                width: { xs: "100%", sm: "auto", flexGrow: 1 },
                maxWidth: { sm: '350px' },
                '& .MuiInputBase-root': {
                  fontFamily: "var(--font-nunito)"
                }
              }}
            />
            
            <Box sx={{ 
              display: "flex", 
              gap: { xs: 1, sm: 1.5 }, 
              width: { xs: "100%", sm: "auto" },
              flexWrap: "wrap"
            }}>
              <FormControl 
                size="small" 
                sx={{ 
                  minWidth: 130,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    backgroundColor: "#ffffff",
                    fontFamily: "var(--font-nunito)",
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(0,0,0,0.08)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(51, 78, 172, 0.2)',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#334eac',
                    },
                  }
                }}
              >
                <InputLabel id="status-filter-label" sx={{ fontFamily: "var(--font-nunito)" }}>Status</InputLabel>
                <Select
                  labelId="status-filter-label"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | "enrolled" | "dropped")}
                  label="Status"
                >
                  <MenuItem value="all" sx={{ fontFamily: "var(--font-nunito)" }}>All Students</MenuItem>
                  <MenuItem value="enrolled" sx={{ fontFamily: "var(--font-nunito)" }}>Enrolled</MenuItem>
                  <MenuItem value="dropped" sx={{ fontFamily: "var(--font-nunito)" }}>Dropped</MenuItem>
                </Select>
              </FormControl>
              
              <Button 
                variant="outlined" 
                size="small" 
                startIcon={<SortIcon />} 
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                sx={{
                  borderRadius: 2,
                  textTransform: "none",
                  borderColor: 'rgba(0,0,0,0.08)',
                  color: '#64748b',
                  bgcolor: "#ffffff",
                  fontFamily: "var(--font-nunito)",
                  px: 2,
                  '&:hover': {
                    borderColor: '#334eac',
                    bgcolor: 'rgba(51, 78, 172, 0.04)',
                    color: '#334eac'
                  }
                }}
              >
                {sortOrder === "asc" ? "A-Z" : "Z-A"}
              </Button>
              
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={openExportMenu}
                sx={{
                  borderRadius: 2,
                  textTransform: "none",
                  borderColor: 'rgba(0,0,0,0.08)',
                  color: '#64748b',
                  bgcolor: "#ffffff",
                  fontFamily: "var(--font-nunito)",
                  px: 2,
                  '&:hover': {
                    borderColor: '#334eac',
                    bgcolor: 'rgba(51, 78, 172, 0.04)',
                    color: '#334eac'
                  }
                }}
              >
                Export
              </Button>
              
              <Menu
                anchorEl={exportAnchorEl}
                open={Boolean(exportAnchorEl)}
                onClose={closeExportMenu}
                PaperProps={{
                  elevation: 2,
                  sx: {
                    borderRadius: 2,
                    mt: 1,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    border: '1px solid rgba(0,0,0,0.08)',
                    minWidth: '180px'
                  }
                }}
              >
                <MenuItem onClick={() => exportData("csv")} sx={{ fontFamily: "var(--font-nunito)", py: 1.5 }}>
                  <ListItemIcon>📄</ListItemIcon>
                  <ListItemText primary="Export as CSV" primaryTypographyProps={{ fontFamily: "var(--font-nunito)" }} />
                </MenuItem>
                <MenuItem onClick={() => exportData("pdf")} sx={{ fontFamily: "var(--font-nunito)", py: 1.5 }}>
                  <ListItemIcon>📑</ListItemIcon>
                  <ListItemText primary="Export as PDF" primaryTypographyProps={{ fontFamily: "var(--font-nunito)" }} />
                </MenuItem>
              </Menu>
            </Box>
          </Box>
            {/* Students Table */}
          <TableContainer 
            sx={{ 
              maxHeight: "550px",
              '&::-webkit-scrollbar': {
                width: '8px',
                height: '8px',
              },
              '&::-webkit-scrollbar-track': {
                background: '#f1f1f1',
                borderRadius: '10px',
              },
              '&::-webkit-scrollbar-thumb': {
                background: '#c1c1c1',
                borderRadius: '10px',
                '&:hover': {
                  background: '#a1a1a1',
                },
              },
            }}
          >
            <Table stickyHeader size={isMobile ? "small" : "medium"}>
              <TableHead>
                <TableRow sx={{ 
                  '& th': { 
                    bgcolor: '#f9fafb',
                    borderBottom: '2px solid rgba(0,0,0,0.05)'
                  } 
                }}>
                  {attendanceMode && (
                    <TableCell padding="checkbox" sx={{ pl: { xs: 2, sm: 3 } }}>
                      <CustomCheckbox 
                        checked={students.filter(s => s.statusId === "1").length > 0 && 
                                students.filter(s => s.statusId === "1").every(s => s.selected)}
                        onChange={handleSelectAllStudents}
                        inputProps={{ 'aria-label': 'select all students' }}
                        sx={{
                          color: '#334eac',
                          '&.Mui-checked': {
                            color: '#334eac',
                          },
                        }}
                      />
                    </TableCell>
                  )}
                  <TableCell 
                    sx={{ 
                      fontWeight: "600", 
                      fontSize: "0.95rem", 
                      color: "#1e293b",
                      fontFamily: "var(--font-gilroy)",
                      pl: attendanceMode ? { xs: 1, sm: 2 } : { xs: 2, sm: 3 }
                    }}
                  >
                    Student
                  </TableCell>
                  {!isMobile && (
                    <TableCell 
                      sx={{ 
                        fontWeight: "600", 
                        fontSize: "0.95rem",
                        color: "#1e293b",
                        fontFamily: "var(--font-gilroy)" 
                      }}
                    >
                      Email
                    </TableCell>
                  )}
                  <TableCell 
                    sx={{ 
                      fontWeight: "600", 
                      fontSize: "0.95rem",
                      color: "#1e293b",
                      fontFamily: "var(--font-gilroy)" 
                    }}
                  >
                    Status
                  </TableCell>
                  {!isMobile && (
                    <TableCell 
                      sx={{ 
                        fontWeight: "600", 
                        fontSize: "0.95rem",
                        color: "#1e293b",
                        fontFamily: "var(--font-gilroy)" 
                      }}
                    >
                      Last Attendance
                    </TableCell>
                  )}
                  {!attendanceMode && (
                    <TableCell 
                      sx={{ 
                        fontWeight: "600", 
                        fontSize: "0.95rem",
                        color: "#1e293b",
                        fontFamily: "var(--font-gilroy)" 
                      }} 
                      align="right"
                    >
                      Actions
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>              <TableBody>
                {sortedStudents.length > 0 ? (
                  sortedStudents.map((student) => (
                    <TableRow 
                      key={student.id} 
                      hover
                      onClick={() => attendanceMode ? handleSelectStudent(student.id) : handleOpenCalendar(student)}
                      sx={{
                        cursor: 'pointer',
                        '&:hover': { 
                          bgcolor: 'rgba(51, 78, 172, 0.04)', 
                        },
                        '& td': { 
                          borderColor: 'rgba(0,0,0,0.05)',
                          py: 1.5,
                          fontFamily: "var(--font-nunito)" 
                        },
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      {attendanceMode && (
                        <TableCell padding="checkbox" sx={{ pl: { xs: 2, sm: 3 } }}>
                          <CustomCheckbox 
                            checked={!!student.selected}
                            onChange={() => handleSelectStudent(student.id)}
                            disabled={student.statusId !== "1"}
                            inputProps={{ 'aria-labelledby': student.id }}
                            sx={{
                              color: '#334eac',
                              '&.Mui-checked': {
                                color: '#334eac',
                              },
                              '&.Mui-disabled': {
                                color: 'rgba(0, 0, 0, 0.26)',
                              },
                            }}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center" }}>
                          <Badge 
                            overlap="circular"
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                            badgeContent={
                              student.attendancePercentage !== undefined ? (
                                <Tooltip title={`${student.attendancePercentage}% attendance`}>
                                  <Box
                                    sx={{
                                      width: 14,
                                      height: 14,
                                      borderRadius: '50%',
                                      bgcolor: student.attendancePercentage > 75 
                                        ? 'success.main' 
                                        : student.attendancePercentage > 50 
                                          ? 'warning.main' 
                                          : 'error.main',
                                      border: '2px solid white'
                                    }}
                                  />
                                </Tooltip>
                              ) : null
                            }
                          >
                            <Avatar 
                              src={student.profileImage || undefined} 
                              alt={student.fullName.charAt(0)}
                              sx={{ 
                                width: 38, 
                                height: 38, 
                                mr: 1.5,
                                bgcolor: student.profileImage ? undefined : `#${Math.floor(Math.random()*16777215).toString(16)}`
                              }}
                            >
                              {student.fullName.charAt(0)}
                            </Avatar>
                          </Badge>
                          <Box>
                            <Typography variant="body1" fontWeight="500">
                              {student.fullName}
                              {/* Absence warning */}
                              {(student.absenceCount ?? 0) === 2 && (
                                <Tooltip title="Close to 3 absences!">
                                  <Chip label="⚠️ 2 absences" color="warning" size="small" sx={{ ml: 1 }} />
                                </Tooltip>
                              )}
                              {(student.absenceCount ?? 0) >= 3 && (
                                <Tooltip title="3 or more absences!">
                                  <Chip label="❗ 3+ absences" color="error" size="small" sx={{ ml: 1 }} />
                                </Tooltip>
                              )}
                            </Typography>
                            {isMobile && student.email && (
                              <Typography variant="caption" color="text.secondary">
                                {student.email}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      {!isMobile && (
                        <TableCell>
                          {student.email || "No email provided"}
                        </TableCell>
                      )}
                      <TableCell>
                        <Chip
                          label={student.statusId === "1" ? "Enrolled" : "Dropped"}
                          size="small"
                          color={student.statusId === "1" ? "success" : "error"}
                          variant="outlined"
                          sx={{ fontWeight: 500 }}
                        />
                      </TableCell>
                      {!isMobile && (
                        <TableCell>
                          {student.lastAttendance ? (
                            <Tooltip title={`Last attended on ${student.lastAttendance}`}>
                              <Box>
                                {student.lastAttendance}
                              </Box>
                            </Tooltip>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No record
                            </Typography>
                          )}
                        </TableCell>
                      )}
                      {!attendanceMode && (
                        <TableCell align="right">
                          <Box>
                            <Tooltip title={student.statusId === "1" ? "Mark as Dropped" : "Mark as Enrolled"}>
                              <IconButton 
                                size="small" 
                                color={student.statusId === "1" ? "error" : "success"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  student.statusId === "1" 
                                    ? openConfirmDialog(student.id, "drop")
                                    : handleUpdateStatus(student.id, "1");
                                }}
                              >
                                {student.statusId === "1" ? "📝" : "✅"}
                              </IconButton>
                            </Tooltip>
                            
                            <Tooltip title="Remove Student">
                              <IconButton 
                                size="small" 
                                sx={{ color: "#D32F2F" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openConfirmDialog(student.id, "remove");
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={attendanceMode ? 5 : 4} align="center" sx={{ py: 3 }}>
                      {searchTerm || statusFilter !== "all" ? "No matching students found." : "No students enrolled yet."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
            {/* Empty View Guidance */}
          {students.length === 0 && !loading && (
            <Box sx={{ p: 6, textAlign: "center" }}>
              <Avatar 
                sx={{ 
                  width: 80,
                  height: 80,
                  mx: 'auto',
                  mb: 3,
                  bgcolor: 'rgba(51, 78, 172, 0.08)',
                  color: '#334eac'
                }}
              >
                <PersonIcon sx={{ fontSize: 40 }} />
              </Avatar>
              <Typography 
                variant="h5" 
                gutterBottom
                sx={{ 
                  fontFamily: "var(--font-gilroy)",
                  fontWeight: 600,
                  color: "#1e293b",
                  mb: 2
                }}
              >
                No Students Enrolled
              </Typography>
              <Typography 
                variant="body1" 
                sx={{ 
                  mb: 4, 
                  maxWidth: 450, 
                  mx: "auto",
                  color: "#64748b",
                  fontFamily: "var(--font-nunito)",
                  fontSize: '1.05rem',
                  lineHeight: 1.5
                }}
              >
                Share the class code with your students so they can join this classroom.
              </Typography>
              <Button 
                variant="contained" 
                onClick={copyClassCode}
                startIcon={<ContentCopyIcon />}
                sx={{
                  textTransform: 'none',
                  bgcolor: '#334eac',
                  borderRadius: 2,
                  py: 1.5,
                  px: 4,
                  fontFamily: "var(--font-nunito)",
                  fontWeight: 600,
                  fontSize: '1rem',
                  boxShadow: '0 4px 12px rgba(51, 78, 172, 0.2)',
                  '&:hover': {
                    bgcolor: '#22357a'
                  }
                }}
              >
                Copy Class Code
              </Button>
            </Box>
          )}
        </Card>
          {/* Confirmation Dialog */}
        <Dialog 
          open={confirmDialogOpen} 
          onClose={() => setConfirmDialogOpen(false)}
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              maxWidth: '450px',
              width: '100%'
            }
          }}
        >
          <DialogTitle sx={{ 
            pb: 1,
            pt: 3,
            fontFamily: "var(--font-gilroy)",
            fontWeight: 600,
            color: "#1e293b",
            fontSize: "1.3rem"
          }}>
            {action === "remove" ? "Remove Student" : "Mark Student as Dropped"}
          </DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ 
              color: "#64748b",
              fontFamily: "var(--font-nunito)",
              fontSize: "1rem",
              mb: 1
            }}>
              {action === "remove" 
                ? "Are you sure you want to remove this student from the classroom? This action cannot be undone."
                : "Are you sure you want to mark this student as dropped? You can change this later if needed."
              }
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button 
              onClick={() => setConfirmDialogOpen(false)}
              sx={{
                textTransform: "none",
                fontFamily: "var(--font-nunito)",
                fontWeight: 600,
                color: "#64748b",
                borderRadius: 2,
                mr: 1,
                px: 3,
                '&:hover': {
                  backgroundColor: "rgba(0,0,0,0.04)"
                }
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmAction} 
              color={action === "remove" ? "error" : "primary"}
              variant="contained"
              autoFocus
              sx={{
                textTransform: "none",
                fontFamily: "var(--font-nunito)",
                fontWeight: 600,
                borderRadius: 2,
                px: 3,
                bgcolor: action === "remove" ? "#ef4444" : "#334eac",
                '&:hover': {
                  bgcolor: action === "remove" ? "#dc2626" : "#22357a"
                }
              }}
            >
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
          {/* Snackbar Notification */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          TransitionComponent={Fade}
          sx={{
            bottom: { xs: 16, sm: 24 }
          }}
        >
          <Alert 
            onClose={handleCloseSnackbar} 
            severity={snackbarSeverity} 
            variant="filled"
            icon={snackbarSeverity === "success" ? <CheckCircleIcon fontSize="inherit" /> : undefined}
            sx={{ 
              width: '100%',
              borderRadius: 2,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              fontFamily: "var(--font-nunito)",
              fontWeight: 500,
              px: 2,
              py: 1.5,
              backgroundColor: snackbarSeverity === "success" ? "#10b981" : undefined
            }}
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>        {/* Attendance Calendar Modal */}
        <Modal
          open={calendarModalOpen}
          onClose={handleCloseCalendar}
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300 }}
        >
          <Box sx={{
            bgcolor: '#ffffff',
            borderRadius: 3,
            p: { xs: 2.5, sm: 4 },
            minWidth: { xs: 320, sm: 640, md: 800 },
            maxWidth: '90vw',
            width: { xs: '90vw', sm: '800px' },
            maxHeight: '90vh',
            boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            border: '1px solid rgba(0,0,0,0.08)',
            overflowY: 'auto',
          }}>
            <IconButton 
              onClick={handleCloseCalendar} 
              sx={{ 
                position: 'absolute', 
                top: 16, 
                right: 16,
                bgcolor: 'rgba(51, 78, 172, 0.08)',
                color: '#334eac',
                '&:hover': {
                  bgcolor: 'rgba(51, 78, 172, 0.15)',
                }
              }} 
              aria-label="Close calendar"
            >
              <CloseIcon />
            </IconButton>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, width: '100%' }}>
              <Avatar
                sx={{ 
                  bgcolor: '#334eac', 
                  mr: 2,
                  width: 44,
                  height: 44
                }}
              >
                {calendarStudent?.fullName?.charAt(0) || 'A'}
              </Avatar>
              <Box>
                <Typography 
                  variant="h5" 
                  sx={{ 
                    color: '#1e293b', 
                    fontWeight: 700,
                    fontFamily: "var(--font-gilroy)",
                    fontSize: { xs: '1.3rem', sm: '1.5rem' }
                  }}
                >
                  {calendarStudent ? `${calendarStudent.fullName}` : 'Attendance Calendar'}
                </Typography>
                {calendarStudent && (
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: '#64748b',
                      fontFamily: "var(--font-nunito)"
                    }}
                  >
                    Attendance History
                  </Typography>
                )}
              </Box>
            </Box>
            
            {calendarLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                <CircularProgress size={40} sx={{ color: '#334eac' }} />
              </Box>
            ) : (
              <Box sx={{ 
                width: '100%',
                p: { xs: 1, sm: 2 },
                bgcolor: '#f9faff',
                borderRadius: 2
              }}>
                <AttendanceCalendar
                  year={calendarYear}
                  month={calendarMonth}
                  entries={calendarEntries}
                />
              </Box>
            )}
          </Box>
        </Modal>
      </Container>
    </Box>
  );
};

// Type for Checkbox component
interface CheckboxProps {
  checked: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  inputProps?: Record<string, any>;
  disabled?: boolean;
  sx?: any; // Allow MUI sx styling prop
}

const CustomCheckbox = ({ checked, onChange, inputProps = {}, disabled = false, sx = {} }: CheckboxProps) => {
  return (
    <Box 
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        borderRadius: 1,
        border: '2px solid',
        borderColor: checked ? 'primary.main' : 'action.disabled',
        bgcolor: checked ? 'primary.main' : 'transparent',
        color: '#fff',
        transition: 'all 0.2s',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'default' : 'pointer',
        ...sx // Spread the sx prop to apply custom styles
      }}
      onClick={(e) => {
        if (!disabled) {
          e.stopPropagation();
          const event = { target: { checked: !checked } } as React.ChangeEvent<HTMLInputElement>;
          onChange(event);
        }
      }}
    >
      {checked && <CheckBoxIcon fontSize="small" />}
    </Box>
  );
};

export default ClassroomPage;
