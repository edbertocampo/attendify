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
  Checkbox
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
import LoadingOverlay from "../../../components/LoadingOverlay";

interface Student {
  id: string;
  fullName: string;
  statusId: string;
  email?: string;
  lastAttendance?: string;
  profileImage?: string;
  attendancePercentage?: number;
  selected?: boolean;
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
          
          // Get user information using studentId which maps to user's id
          const userData = usersMap.get(studentData.studentId);
          
          return {
            id: doc.id,
            fullName: studentData.fullName || "Unknown",
            statusId: studentData.statusId || "1", // Default to "Enrolled"
            email: userData?.email || "No email provided",
            lastAttendance: studentData.lastAttendance || "",
            profileImage: studentData.profileImage || "",
            attendancePercentage: Math.round(attendancePercentage),
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
    <Box sx={{ minHeight: "100vh", bgcolor: "#F7F9FC", pb: 8 }}>
      {(loading || takingAttendance) && 
        <LoadingOverlay isLoading={true} message={takingAttendance ? "Recording attendance..." : "Loading classroom data..."} />
      }
      
      {/* App Bar */}
      <Box 
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          px: 3,
          py: 1.5,
          bgcolor: "primary.main",
          color: "#FFF",
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.15)",
          zIndex: 1100,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Tooltip title="Back to Dashboard">
            <IconButton color="inherit" onClick={() => window.history.back()} sx={{ mr: 1 }}>
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
          <SchoolIcon sx={{ mr: 1.5, fontSize: 28 }} />
          <Typography variant="h6" fontWeight="600" noWrap>
            {classroomName || "Classroom"}
          </Typography>
        </Box>

        <Box sx={{ display: "flex" }}>
          <Tooltip title="Refresh Data">
            <IconButton color="inherit" onClick={handleRefresh} sx={{ ml: 1 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Logout">
            <IconButton color="inherit" onClick={() => alert("Logging out...")}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Main Content */}
      <Container maxWidth="lg" sx={{ mt: 10, pt: 4 }}>
        {/* Classroom Info Card */}
        <Card 
          elevation={2} 
          sx={{ 
            mb: 4, 
            borderRadius: 2,
            p: 3,
            background: "linear-gradient(120deg, #3f51b5 30%, #5c6bc0 100%)",
            color: "white"
          }}
        >
          <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h4" fontWeight="700" gutterBottom>
                {classroomName || "Unnamed Classroom"}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
                <Typography variant="body1" sx={{ mr: 2 }}>
                  Class Code: <span style={{ fontWeight: "bold" }}>{classCode}</span>
                </Typography>
                <Button 
                  variant="contained" 
                  size="small" 
                  startIcon={<ContentCopyIcon />} 
                  onClick={copyClassCode}
                  sx={{ 
                    bgcolor: "rgba(255,255,255,0.2)", 
                    '&:hover': { bgcolor: "rgba(255,255,255,0.3)" } 
                  }}
                >
                  Copy
                </Button>
              </Box>
            </Box>
            <Box sx={{ display: "flex", justifyContent: { xs: "flex-start", sm: "flex-end" }, mt: { xs: 2, sm: 0 } }}>
              <Box sx={{ textAlign: "center", mr: 3 }}>
                <GroupIcon sx={{ fontSize: 32, mb: 0.5 }} />
                <Typography variant="h5" fontWeight="700">{students.length}</Typography>
                <Typography variant="body2">Total Students</Typography>
              </Box>
              <Box sx={{ textAlign: "center", mr: 3 }}>
                <CheckCircleIcon sx={{ fontSize: 32, mb: 0.5, color: "#8eff8e" }} />
                <Typography variant="h5" fontWeight="700" color="#8eff8e">{enrolledCount}</Typography>
                <Typography variant="body2">Enrolled</Typography>
              </Box>
              <Box sx={{ textAlign: "center" }}>
                <PersonIcon sx={{ fontSize: 32, mb: 0.5, color: "#ffcccb" }} />
                <Typography variant="h5" fontWeight="700" color="#ffcccb">{droppedCount}</Typography>
                <Typography variant="body2">Dropped</Typography>
              </Box>
            </Box>
          </Box>
          
          {/* Quick Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, mt: 3, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<CheckCircleIcon />}
              onClick={handleToggleAttendanceMode}
              sx={{
                bgcolor: attendanceMode ? "error.main" : "rgba(255,255,255,0.2)",
                '&:hover': { bgcolor: attendanceMode ? "error.dark" : "rgba(255,255,255,0.3)" }
              }}
            >
              {attendanceMode ? "Cancel Attendance" : "Take Attendance"}
            </Button>
          </Box>
        </Card>

        {/* Student Management Section */}
        <Card elevation={2} sx={{ borderRadius: 2 }}>
          <Box sx={{ 
            p: 2, 
            borderBottom: "1px solid #eaeaea", 
            bgcolor: "#f8f9fa",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap"
          }}>
            <Typography variant="h6" fontWeight="600" sx={{ my: 1 }}>
              {attendanceMode ? 
                `Take Attendance (${selectedCount} selected)` : 
                "Student Management"
              }
            </Typography>
            
            {attendanceMode && (
              <Button
                variant="contained"
                color="success"
                disabled={takingAttendance}
                onClick={handleSubmitAttendance}
                startIcon={<CheckBoxIcon />}
              >
                Submit Attendance
              </Button>
            )}
          </Box>
          
          {/* Search and Filter Bar */}
          <Box sx={{ 
            p: 2, 
            display: "flex", 
            alignItems: "center", 
            flexWrap: "wrap", 
            gap: 2,
            borderBottom: "1px solid #f0f0f0"
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
                    <SearchIcon sx={{ color: "text.secondary" }} />
                  </InputAdornment>
                ),
              }}
              sx={{ width: { xs: "100%", sm: "auto", flexGrow: 1 } }}
            />
            
            <Box sx={{ display: "flex", gap: 1, width: { xs: "100%", sm: "auto" } }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel id="status-filter-label">Status</InputLabel>
                <Select
                  labelId="status-filter-label"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | "enrolled" | "dropped")}
                  label="Status"
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="enrolled">Enrolled</MenuItem>
                  <MenuItem value="dropped">Dropped</MenuItem>
                </Select>
              </FormControl>
              
              <Button 
                variant="outlined" 
                size="small" 
                startIcon={<SortIcon />} 
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              >
                {sortOrder === "asc" ? "A-Z" : "Z-A"}
              </Button>
              
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={openExportMenu}
              >
                Export
              </Button>
              
              <Menu
                anchorEl={exportAnchorEl}
                open={Boolean(exportAnchorEl)}
                onClose={closeExportMenu}
              >
                <MenuItem onClick={() => exportData("csv")}>
                  <ListItemIcon>📄</ListItemIcon>
                  <ListItemText>Export as CSV</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => exportData("pdf")}>
                  <ListItemIcon>📑</ListItemIcon>
                  <ListItemText>Export as PDF</ListItemText>
                </MenuItem>
              </Menu>
            </Box>
          </Box>
          
          {/* Students Table */}
          <TableContainer sx={{ maxHeight: "550px" }}>
            <Table stickyHeader size={isMobile ? "small" : "medium"}>
              <TableHead>
                <TableRow>
                  {attendanceMode && (
                    <TableCell padding="checkbox">
                      <CustomCheckbox 
                        checked={students.filter(s => s.statusId === "1").length > 0 && 
                                students.filter(s => s.statusId === "1").every(s => s.selected)}
                        onChange={handleSelectAllStudents}
                        inputProps={{ 'aria-label': 'select all students' }}
                      />
                    </TableCell>
                  )}
                  <TableCell sx={{ fontWeight: "600", fontSize: "0.95rem" }}>Student</TableCell>
                  {!isMobile && (
                    <TableCell sx={{ fontWeight: "600", fontSize: "0.95rem" }}>Email</TableCell>
                  )}
                  <TableCell sx={{ fontWeight: "600", fontSize: "0.95rem" }}>Status</TableCell>
                  {!isMobile && (
                    <TableCell sx={{ fontWeight: "600", fontSize: "0.95rem" }}>Last Attendance</TableCell>
                  )}
                  {!attendanceMode && (
                    <TableCell sx={{ fontWeight: "600", fontSize: "0.95rem" }} align="right">Actions</TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedStudents.length > 0 ? (
                  sortedStudents.map((student) => (
                    <TableRow 
                      key={student.id} 
                      hover
                      onClick={() => handleSelectStudent(student.id)}
                      sx={attendanceMode ? { cursor: 'pointer' } : {}}
                    >
                      {attendanceMode && (
                        <TableCell padding="checkbox">
                          <CustomCheckbox 
                            checked={!!student.selected}
                            onChange={() => handleSelectStudent(student.id)}
                            disabled={student.statusId !== "1"}
                            inputProps={{ 'aria-labelledby': student.id }}
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
            <Box sx={{ p: 4, textAlign: "center" }}>
              <PersonIcon sx={{ fontSize: 60, color: "text.disabled", mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Students Enrolled
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 450, mx: "auto" }}>
                Share the class code with your students so they can join this classroom.
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={copyClassCode}
                  startIcon={<ContentCopyIcon />}
                >
                  Copy Class Code
                </Button>
              </Box>
            </Box>
          )}
        </Card>
        
        {/* Confirmation Dialog */}
        <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
          <DialogTitle>
            {action === "remove" ? "Remove Student" : "Mark Student as Dropped"}
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              {action === "remove" 
                ? "Are you sure you want to remove this student from the classroom? This action cannot be undone."
                : "Are you sure you want to mark this student as dropped? You can change this later if needed."
              }
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleConfirmAction} 
              color={action === "remove" ? "error" : "primary"}
              variant="contained"
              autoFocus
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
}

const CustomCheckbox = ({ checked, onChange, inputProps = {}, disabled = false }: CheckboxProps) => {
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
        cursor: disabled ? 'default' : 'pointer'
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
