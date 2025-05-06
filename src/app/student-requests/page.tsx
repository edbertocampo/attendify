"use client";

import { useState, useEffect } from "react";
import { Box, Paper, Typography, Button, AppBar, Toolbar, IconButton, Grid, Container, 
  Dialog, DialogTitle, DialogContent, DialogActions, Card, CardContent, Chip, Avatar, Link, CircularProgress } from "@mui/material";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, doc, updateDoc, getDoc, orderBy, Timestamp } from "firebase/firestore";
import LogoutIcon from "@mui/icons-material/Logout";
import HomeIcon from '@mui/icons-material/Home';
import PeopleIcon from '@mui/icons-material/People';
import DescriptionIcon from '@mui/icons-material/Description';
import SettingsIcon from '@mui/icons-material/Settings';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import LoadingOverlay from '../../components/LoadingOverlay';

export default function StudentRequests() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [excuseRequests, setExcuseRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [instructorClassrooms, setInstructorClassrooms] = useState<any[]>([]);
  const [classroomMap, setClassroomMap] = useState<{[key: string]: any}>({});
  const [studentMap, setStudentMap] = useState<{[key: string]: any}>({});
  // New state for document viewer modal
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentLoading, setDocumentLoading] = useState(true);

  // Add this useEffect to handle client-side initialization
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Update the authentication useEffect
  useEffect(() => {
    if (!isClient) return; // Only run auth check on client

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
      } else {
        setUserId(user.uid);
        await fetchInstructorClassrooms(user.uid);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, isClient]);

  // Fetch instructor's classrooms
  const fetchInstructorClassrooms = async (uid: string) => {
    try {
      const q = query(
        collection(db, "classrooms"), 
        where("createdBy", "==", uid),
        where("isArchived", "==", false)
      );
      const querySnapshot = await getDocs(q);
      const classroomList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setInstructorClassrooms(classroomList);
      
      // Create classroom map for easier access
      const classroomMapData: {[key: string]: any} = {};
      classroomList.forEach(classroom => {
        classroomMapData[classroom.id] = classroom;
      });
      setClassroomMap(classroomMapData);
      
      if (classroomList.length > 0) {
        await fetchExcuseRequests(classroomList.map(c => c.id));
        await fetchStudentProfiles();
      }
    } catch (error) {
      console.error("Error fetching classrooms:", error);
    }
  };

  // Fetch student excuse requests
  const fetchExcuseRequests = async (classroomIds: string[]) => {
    try {
      console.log("Fetching excuses for classrooms:", classroomIds);
      
      // Fetch all attendance records with status 'excused'
      const excusedQuery = query(
        collection(db, "attendance"),
        where("status", "==", "excused"),
        orderBy("submittedTime", "desc")
      );
      
      const excusedSnapshot = await getDocs(excusedQuery);
      console.log("Total excused records found:", excusedSnapshot.size);
      
      // Process results, filtering for records from instructor's classrooms
      const allDocs: { [id: string]: any } = {};
      const studentIds: string[] = [];
      
      excusedSnapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Check if this record belongs to one of the instructor's classrooms
        // Use classCode field from the document instead of classroomId
        if (classroomIds.includes(data.classCode)) {
          console.log("Found matching record:", doc.id);
          
          // Include all excuses that don't have an excuseStatus field (meaning not yet reviewed)
          if (!data.excuseStatus) {
            allDocs[doc.id] = {
              id: doc.id,
              ...data,
              // Map fields to the expected structure for the UI
              classroomId: data.classCode,
              excuseReason: data.excuse,
              // Handle the file URL - it's stored as a path with format /api/files/{id}
              fileUrl: data.excuseFile ? `${window.location.origin}${data.excuseFile}` : null,
              // Use the submittedTime field if available, otherwise fall back to timestamp
              date: data.submittedTime?.toDate() || data.timestamp?.toDate() || new Date()
            };
            
            // Collect student IDs for fetching their details
            if (data.studentId && !studentIds.includes(data.studentId)) {
              studentIds.push(data.studentId);
            }
          }
        }
      });
      
      // Fetch student details for the collected student IDs
      if (studentIds.length > 0) {
        await fetchStudentDetails(studentIds, allDocs);
      }
      
      // Convert to array and set state
      const excuses = Object.values(allDocs);
      console.log("Found excuses:", excuses.length); // Debug log
      console.log("Excuse data:", excuses); // Additional debug
      setExcuseRequests(excuses);
      
    } catch (error) {
      console.error("Error fetching excuse requests:", error);
    }
  };

  // Fetch student details including fullName
  const fetchStudentDetails = async (studentIds: string[], excuseRequests: { [id: string]: any }) => {
    try {
      for (const studentId of studentIds) {
        // Find the student in any class
        const studentQuery = query(
          collection(db, "students"),
          where("studentId", "==", studentId)
        );
        
        const studentSnapshot = await getDocs(studentQuery);
        
        if (!studentSnapshot.empty) {
          let studentData = null;
          
          // First try to find the student in the specific class for the requests
          for (const request of Object.values(excuseRequests)) {
            if (request.studentId === studentId) {
              // Look for student in the specific class
              const specificClassQuery = query(
                collection(db, "students"),
                where("studentId", "==", studentId),
                where("classCode", "==", request.classroomId)
              );
              
              const specificClassSnapshot = await getDocs(specificClassQuery);
              
              if (!specificClassSnapshot.empty) {
                studentData = specificClassSnapshot.docs[0].data();
                break;
              }
            }
          }
          
          // If no specific class match, use the first student record found
          if (!studentData) {
            studentData = studentSnapshot.docs[0].data();
          }
          
          // Update all requests from this student with their fullName
          for (const id in excuseRequests) {
            if (excuseRequests[id].studentId === studentId) {
              excuseRequests[id].studentName = studentData.fullName || studentData.name || excuseRequests[id].studentName || "Unknown Student";
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching student details:", error);
    }
  };

  // Fetch student profiles for the requests
  const fetchStudentProfiles = async () => {
    try {
      const studentQuery = query(collection(db, "students"));
      const studentSnapshot = await getDocs(studentQuery);
      
      const studentMapData: {[key: string]: any} = {};
      studentSnapshot.forEach(doc => {
        const data = doc.data();
        // Use studentId as the key instead of document ID for easier lookup
        if (data.studentId) {
          studentMapData[data.studentId] = data;
        } else {
          studentMapData[doc.id] = data;
        }
      });
      
      setStudentMap(studentMapData);
    } catch (error) {
      console.error("Error fetching student profiles:", error);
    }
  };

  // Handle viewing request details
  const handleViewDetails = (request: any) => {
    setSelectedRequest(request);
    setDetailsOpen(true);
  };

  // Handle approving an excuse
  const handleApproveExcuse = async (requestId: string) => {
    try {
      const attendanceRef = doc(db, "attendance", requestId);
      await updateDoc(attendanceRef, {
        excuseStatus: "approved",
        reviewedBy: userId,
        reviewedAt: Timestamp.now()
      });
      
      // Refresh the list
      setDetailsOpen(false);
      if (instructorClassrooms.length > 0) {
        await fetchExcuseRequests(instructorClassrooms.map(c => c.id));
      }
    } catch (error) {
      console.error("Error approving excuse:", error);
    }
  };

  // Handle rejecting an excuse
  const handleRejectExcuse = async (requestId: string) => {
    try {
      const attendanceRef = doc(db, "attendance", requestId);
      await updateDoc(attendanceRef, {
        excuseStatus: "rejected",
        status: "absent", // Change status to absent
        reviewedBy: userId,
        reviewedAt: Timestamp.now()
      });
      
      // Refresh the list
      setDetailsOpen(false);
      if (instructorClassrooms.length > 0) {
        await fetchExcuseRequests(instructorClassrooms.map(c => c.id));
      }
    } catch (error) {
      console.error("Error rejecting excuse:", error);
    }
  };

  // Add this function to handle opening documents in modal
  const handleOpenDocument = (url: string) => {
    setDocumentUrl(url);
    setDocumentModalOpen(true);
    setDocumentLoading(true); // Reset loading state when opening a new document
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <>
      {isLoading && <LoadingOverlay isLoading={isLoading} message="Loading requests..." />}
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f8fafc' }}>
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
              A
            </Typography>
          </Box>

          {/* Navigation Items */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, px: 2 }}>
            <Button
              startIcon={<HomeIcon />}
              onClick={() => router.push('/dashboard/instructor')}
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
                Classrooms
              </Typography>
            </Button>

            <Button
              startIcon={<PeopleIcon />}
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
          <Box sx={{ mb: 4 }}>
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 600, 
                color: '#1e293b',
                mb: 1,
                fontSize: { xs: '1.5rem', sm: '2rem' }
              }}
            >
              Student Excuse Requests
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#64748b',
                fontSize: { xs: '0.875rem', sm: '1rem' }
              }}
            >
              Review and manage student absence excuse requests
            </Typography>
          </Box>

          {/* Student Requests List */}
          {excuseRequests.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 4,
                textAlign: 'center',
                borderRadius: '16px',
                bgcolor: 'rgba(255, 255, 255, 0.8)',
                border: '1px solid rgba(0, 0, 0, 0.1)'
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  mb: 1,
                  color: '#64748b',
                  fontSize: { xs: '1rem', sm: '1.25rem' }
                }}
              >
                No pending excuse requests
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: '#94a3b8',
                  fontSize: { xs: '0.875rem', sm: '1rem' }
                }}
              >
                When students submit excuse letters, they will appear here for your review
              </Typography>
            </Paper>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {excuseRequests.map((request) => (
                <Card
                  key={request.id}
                  elevation={0}
                  sx={{
                    borderRadius: '16px',
                    bgcolor: 'white',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                    }
                  }}
                >
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar 
                          sx={{ 
                            bgcolor: '#e2e8f0',
                            color: '#64748b',
                            width: { xs: 40, sm: 48 },
                            height: { xs: 40, sm: 48 },
                            mr: 2
                          }}
                        >
                          {request.studentName?.charAt(0) || 'S'}
                        </Avatar>
                        <Box>
                          <Typography 
                            sx={{ 
                              fontWeight: 600,
                              fontSize: { xs: '1rem', sm: '1.125rem' },
                              color: '#0f172a'
                            }}
                          >
                            {request.studentName || 'Student'}
                          </Typography>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: '#64748b',
                              fontSize: { xs: '0.75rem', sm: '0.875rem' }
                            }}
                          >
                            {classroomMap[request.classroomId]?.name || 'Unknown Class'}
                          </Typography>
                        </Box>
                      </Box>
                      <Chip 
                        label="Pending" 
                        size="small"
                        sx={{ 
                          bgcolor: 'rgba(234,179,8,0.1)',
                          color: '#d97706',
                          fontWeight: 500,
                          borderRadius: '8px'
                        }} 
                      />
                    </Box>
                    
                    <Box sx={{ mb: 3 }}>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: '#475569',
                          mb: 1,
                          fontWeight: 500,
                          display: 'inline'
                        }}
                      >
                        Excuse Reason:
                      </Typography>
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          color: '#334155',
                          fontSize: { xs: '0.875rem', sm: '1rem' },
                          lineHeight: 1.6,
                          display: 'inline',
                          ml: 1
                        }}
                      >
                        {request.excuseReason || "No reason provided"}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 2 
                    }}>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: '#64748b',
                          fontSize: { xs: '0.75rem', sm: '0.875rem' }
                        }}
                      >
                        Submitted: {formatDate(request.date)}
                      </Typography>
                      
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {request.fileUrl && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => handleOpenDocument(request.fileUrl)}
                            sx={{
                              textTransform: 'none',
                              borderRadius: '8px',
                              borderColor: '#e2e8f0',
                              color: '#64748b',
                              px: 2,
                              '&:hover': {
                                borderColor: '#cbd5e1',
                                bgcolor: 'rgba(241,245,249,0.8)'
                              }
                            }}
                          >
                            View Document
                          </Button>
                        )}
                        
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => handleViewDetails(request)}
                          endIcon={<VisibilityIcon sx={{ fontSize: '16px' }} />}
                          sx={{
                            textTransform: 'none',
                            borderRadius: '8px',
                            bgcolor: '#0066cc',
                            color: 'white',
                            px: 2,
                            '&:hover': {
                              bgcolor: '#0055b3'
                            }
                          }}
                        >
                          Review
                        </Button>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {/* Request Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            bgcolor: 'white',
            overflow: 'hidden'
          }
        }}
      >
        {selectedRequest && (
          <>
            <DialogTitle sx={{ 
              p: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <IconButton 
                  edge="start" 
                  onClick={() => setDetailsOpen(false)}
                  sx={{ mr: 1 }}
                >
                  <ArrowBackIcon />
                </IconButton>
                <Typography variant="h6">Excuse Request Details</Typography>
              </Box>
            </DialogTitle>
            
            <DialogContent sx={{ p: 3 }}>
              <Box sx={{ mb: 3 }}>
                <Typography
                  variant="body2"
                  sx={{ 
                    color: '#64748b',
                    fontWeight: 500,
                    mb: 1
                  }}
                >
                  STUDENT
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar 
                    sx={{ 
                      bgcolor: '#e2e8f0',
                      color: '#64748b',
                      mr: 1.5
                    }}
                  >
                    {selectedRequest.studentName?.charAt(0) || 'S'}
                  </Avatar>
                  <Box>
                    <Typography 
                      sx={{ 
                        fontWeight: 600,
                        color: '#0f172a'
                      }}
                    >
                      {selectedRequest.studentName || 'Student'}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ color: '#64748b' }}
                    >
                      {studentMap[selectedRequest.studentId]?.email || 'No email provided'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
              
              <Box sx={{ mb: 3 }}>
                <Typography
                  variant="body2"
                  sx={{ 
                    color: '#64748b',
                    fontWeight: 500,
                    mb: 1
                  }}
                >
                  CLASS
                </Typography>
                <Typography 
                  sx={{ 
                    fontWeight: 600,
                    color: '#0f172a'
                  }}
                >
                  {classroomMap[selectedRequest.classroomId]?.name || 'Unknown Class'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  {formatDate(selectedRequest.date)}
                </Typography>
              </Box>
              
              <Box sx={{ mb: 3 }}>
                <Typography
                  variant="body2"
                  sx={{ 
                    color: '#64748b',
                    fontWeight: 500,
                    mb: 1
                  }}
                >
                  EXCUSE REASON
                </Typography>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: '8px',
                    bgcolor: '#f8fafc',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <Typography sx={{ color: '#334155', lineHeight: 1.6 }}>
                    {selectedRequest.excuseReason || "No reason provided"}
                  </Typography>
                </Paper>
              </Box>
              
              {selectedRequest.fileUrl && (
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="body2"
                    sx={{ 
                      color: '#64748b',
                      fontWeight: 500,
                      mb: 1
                    }}
                  >
                    SUPPORTING DOCUMENT
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={() => handleOpenDocument(selectedRequest.fileUrl)}
                    startIcon={<VisibilityIcon />}
                    sx={{
                      textTransform: 'none',
                      borderRadius: '8px',
                      borderColor: '#e2e8f0',
                      color: '#0066cc',
                      '&:hover': {
                        borderColor: '#0066cc',
                        bgcolor: 'rgba(0,102,204,0.04)'
                      }
                    }}
                  >
                    View Attached Document
                  </Button>
                </Box>
              )}
            </DialogContent>
            
            <DialogActions sx={{ 
              p: 3,
              borderTop: '1px solid #e2e8f0',
              justifyContent: 'space-between'
            }}>
              <Button
                variant="outlined"
                color="error"
                startIcon={<CancelIcon />}
                onClick={() => handleRejectExcuse(selectedRequest.id)}
                sx={{
                  textTransform: 'none',
                  borderRadius: '8px',
                  borderColor: '#f87171',
                  color: '#ef4444',
                  px: 3,
                  '&:hover': {
                    borderColor: '#ef4444',
                    bgcolor: 'rgba(239,68,68,0.04)'
                  }
                }}
              >
                Mark as Absent
              </Button>
              
              <Button
                variant="contained"
                color="primary"
                startIcon={<CheckCircleIcon />}
                onClick={() => handleApproveExcuse(selectedRequest.id)}
                sx={{
                  textTransform: 'none',
                  borderRadius: '8px',
                  bgcolor: '#22c55e',
                  color: 'white',
                  px: 3,
                  '&:hover': {
                    bgcolor: '#16a34a'
                  }
                }}
              >
                Approve Excuse
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Document Viewer Modal */}
      <Dialog
        open={documentModalOpen}
        onClose={() => setDocumentModalOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            bgcolor: 'white',
            overflow: 'hidden',
            height: '90vh'
          }
        }}
      >
        <DialogTitle sx={{ 
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton 
              edge="start" 
              onClick={() => setDocumentModalOpen(false)}
              sx={{ mr: 1 }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h6">Document Viewer</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {documentLoading && (
            <Box 
              sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1,
                bgcolor: 'rgba(255,255,255,0.8)'
              }}
            >
              <CircularProgress />
              <Typography sx={{ ml: 2, color: '#64748b' }}>Loading document...</Typography>
            </Box>
          )}
          
          {documentUrl && (
            <iframe 
              src={documentUrl} 
              width="100%" 
              height="100%" 
              style={{ border: 'none' }} 
              onLoad={() => setDocumentLoading(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}