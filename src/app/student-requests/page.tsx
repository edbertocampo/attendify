"use client";

import { useState, useEffect } from "react";
import { Box, Paper, Typography, Button, AppBar, Toolbar, IconButton, Grid, Container, 
  Dialog, DialogTitle, DialogContent, DialogActions, Card, CardContent, Chip, Avatar, Link, CircularProgress, Badge, Tooltip, useMediaQuery, useTheme } from "@mui/material";
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, doc, updateDoc, getDoc, orderBy, Timestamp, onSnapshot } from "firebase/firestore";
import { createExcuseStatusNotification } from "../../lib/notificationService";
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
  const theme = useTheme();
  // Update mobile detection to include tablets (md breakpoint covers both mobile phones and tablets)
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [isLoading, setIsLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [excuseRequests, setExcuseRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [instructorClassrooms, setInstructorClassrooms] = useState<any[]>([]);
  const [classroomMap, setClassroomMap] = useState<{[key: string]: any}>({});
  const [studentMap, setStudentMap] = useState<{[key: string]: any}>({});  
  // Document viewer states
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentLoading, setDocumentLoading] = useState(true);  const [documentType, setDocumentType] = useState<'pdf'|'image'|'other'|null>(null);
  // State for email copy tooltip
  const [tooltipOpen, setTooltipOpen] = useState(false);
  // Loading states for approve/deny actions
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

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

  // Real-time pending excuse requests badge
  useEffect(() => {
    if (!userId) return;
    let unsubscribeClassrooms: (() => void) | null = null;
    let attendanceUnsubscribes: (() => void)[] = [];

    unsubscribeClassrooms = onSnapshot(
      query(collection(db, "classrooms"), where("createdBy", "==", userId)),
      (classSnapshot) => {
        attendanceUnsubscribes.forEach(unsub => unsub());
        attendanceUnsubscribes = [];
        const classroomIds = classSnapshot.docs.map(doc => doc.id);
        if (classroomIds.length === 0) {
          setPendingRequests(0);
          return;
        }
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
            // Update all requests from this student with their fullName and email
          for (const id in excuseRequests) {
            if (excuseRequests[id].studentId === studentId) {
              excuseRequests[id].studentName = studentData.fullName || studentData.name || excuseRequests[id].studentName || "Unknown Student";
              // Also add email to the request object for easier access
              excuseRequests[id].studentEmail = studentData.email || studentData.studentEmail || studentData.emailAddress || null;
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
          // Make sure email field is standardized
          if (data.studentEmail && !data.email) {
            data.email = data.studentEmail;
          }
          studentMapData[data.studentId] = data;
        } else {
          studentMapData[doc.id] = data;
        }
      });
      
      // Now fetch emails from users collection
      await fetchUserEmails(studentMapData);
      
      setStudentMap(studentMapData);
    } catch (error) {
      console.error("Error fetching student profiles:", error);
    }
  };
    // Fetch user emails from users collection
  const fetchUserEmails = async (studentMapData: {[key: string]: any}) => {
    try {
      const userQuery = query(collection(db, "users"));
      const userSnapshot = await getDocs(userQuery);
      
      userSnapshot.forEach(doc => {
        const userData = doc.data();
        // The document ID in the users collection is the same as the studentId
        if (userData.email && studentMapData[doc.id]) {
          // Set the email directly in the studentMapData
          studentMapData[doc.id].email = userData.email;
        }
      });
      
      console.log("Updated student map with emails:", studentMapData);
    } catch (error) {
      console.error("Error fetching user emails:", error);
    }
  };
  // Handle viewing request details
  const handleViewDetails = async (request: any) => {
    try {
      // Get the user email directly from the users collection
      if (request.studentId) {
        const userDocRef = doc(db, "users", request.studentId);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists() && userDoc.data().email) {
          // Add the email directly to the request object
          request.studentEmail = userDoc.data().email;
          console.log("Found user email:", request.studentEmail);
        }
      }
    } catch (error) {
      console.error("Error fetching user email:", error);
    }
    
    setSelectedRequest(request);
    setDetailsOpen(true);
  };  // Handle approving an excuse
  const handleApproveExcuse = async (requestId: string) => {
    try {
      setIsApproving(true); // Set loading state to true
      
      const attendanceRef = doc(db, "attendance", requestId);
      const attendanceDoc = await getDoc(attendanceRef);
      
      if (attendanceDoc.exists()) {
        const attendanceData = attendanceDoc.data();
        
        // Update the attendance record with approval status
        await updateDoc(attendanceRef, {
          excuseStatus: "approved",
          reviewedBy: userId,
          reviewedAt: Timestamp.now()
        });
          // Send notification to student if we have their ID
        if (attendanceData.studentId) {
          // Use the submittedTime from the attendance data or fall back to timestamp
          const submissionDate = attendanceData.submittedTime?.toDate() || 
                                attendanceData.timestamp?.toDate() || 
                                new Date();
                                
          const className = attendanceData.className || selectedRequest.className || classroomMap[attendanceData.classCode]?.name || "Class";
          
          await createExcuseStatusNotification(
            attendanceData.studentId,
            true, // approved
            attendanceData.classCode,
            className,
            attendanceData.subject || null,
            requestId,
            submissionDate
          );
        }
      }
      
      // Refresh the list
      setDetailsOpen(false);
      if (instructorClassrooms.length > 0) {
        await fetchExcuseRequests(instructorClassrooms.map(c => c.id));
      }
    } catch (error) {
      console.error("Error approving excuse:", error);
    } finally {
      setIsApproving(false); // Set loading state back to false
    }
  };

  // Handle rejecting an excuse
  const handleRejectExcuse = async (requestId: string) => {
    try {
      setIsRejecting(true); // Set loading state to true
      
      const attendanceRef = doc(db, "attendance", requestId);
      const attendanceDoc = await getDoc(attendanceRef);
      
      if (attendanceDoc.exists()) {
        const attendanceData = attendanceDoc.data();
        
        // Update the attendance record with rejection status
        await updateDoc(attendanceRef, {
          excuseStatus: "rejected",
          status: "absent", // Change status to absent
          reviewedBy: userId,
          reviewedAt: Timestamp.now()
        });
          // Send notification to student if we have their ID
        if (attendanceData.studentId) {
          // Use the submittedTime from the attendance data or fall back to timestamp
          const submissionDate = attendanceData.submittedTime?.toDate() || 
                               attendanceData.timestamp?.toDate() || 
                               new Date();
                               
          const className = attendanceData.className || selectedRequest.className || classroomMap[attendanceData.classCode]?.name || "Class";
          
          await createExcuseStatusNotification(
            attendanceData.studentId,
            false, // rejected
            attendanceData.classCode,
            className,
            attendanceData.subject || null,
            requestId,
            submissionDate
          );
        }
      }
      
      // Refresh the list
      setDetailsOpen(false);
      if (instructorClassrooms.length > 0) {
        await fetchExcuseRequests(instructorClassrooms.map(c => c.id));
      }
    } catch (error) {
      console.error("Error rejecting excuse:", error);
    } finally {
      setIsRejecting(false); // Set loading state back to false
    }
  };
  // Handle opening documents in modal or browser
  const handleOpenDocument = (url: string) => {
    setDocumentUrl(url);
    setDocumentModalOpen(true);
    setDocumentLoading(true); // Reset loading state when opening a new document
    
    // Determine document type based on file extension
    if (url.match(/\.(pdf)$/i)) {
      setDocumentType('pdf');
    } else if (url.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)) {
      setDocumentType('image');
    } else {
      setDocumentType('other');
    }
    
    // Set timeout to stop showing loading indicator if document takes too long
    const loadingTimeout = setTimeout(() => {
      setDocumentLoading(false);
    }, 5000);
    
    // Clear timeout when component unmounts or a new document is loaded
    return () => clearTimeout(loadingTimeout);
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
        >          {/* Logo */}
          <Box sx={{ px: 3, py: 2, mb: 4, display: 'flex', justifyContent: 'center' }}>
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
            >              <Typography
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
                <Badge color="error" badgeContent={pendingRequests} invisible={pendingRequests === 0} sx={{ '& .MuiBadge-badge': { fontWeight: 600, fontSize: 13, minWidth: 20, height: 20 } }}>
                  <PeopleIcon />
                </Badge>
              }
              onClick={() => router.push('/student-requests')}
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
            >              <Typography
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
              >                <Typography
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
              >                <Typography
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
            ml: { xs: '70px', md: '240px' },
            p: { xs: 2, sm: 3, md: 4 }
          }}
        >
          <Box sx={{ mb: 4 }}>            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 600, 
                color: '#1e293b',
                mb: 1,
                fontSize: { xs: '1.5rem', sm: '2rem' },
                fontFamily: 'var(--font-gilroy)'
              }}
            >
              Student Excuse Requests
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#64748b',
                fontSize: { xs: '0.875rem', sm: '1rem' },
                fontFamily: 'var(--font-nunito)'
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
            >              <Typography
                variant="h6"
                sx={{
                  mb: 1,
                  color: '#64748b',
                  fontSize: { xs: '1rem', sm: '1.25rem' },
                  fontFamily: 'var(--font-gilroy)'
                }}
              >
                No pending excuse requests
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: '#94a3b8',
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                  fontFamily: 'var(--font-nunito)'
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
                        <Box>                          <Typography 
                            sx={{ 
                              fontWeight: 600,
                              fontSize: { xs: '1rem', sm: '1.125rem' },
                              color: '#0f172a',
                              fontFamily: 'var(--font-gilroy)'
                            }}
                          >
                            {request.studentName || 'Student'}
                          </Typography>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: '#64748b',
                              fontSize: { xs: '0.75rem', sm: '0.875rem' },
                              fontFamily: 'var(--font-nunito)'
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
                    
                    <Box sx={{ mb: 3 }}>                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: '#475569',
                          mb: 1,
                          fontFamily: 'var(--font-nunito)',
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
                          ml: 1,
                          fontFamily: 'var(--font-nunito)'
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
                    }}>                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: '#64748b',
                          fontSize: { xs: '0.75rem', sm: '0.875rem' },
                          fontFamily: 'var(--font-nunito)'
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
          <>            <DialogTitle 
              sx={{ 
                p: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #e2e8f0'
              }}
            >
              <span style={{ fontWeight: 500, fontSize: '1.25rem' }}>Excuse Request Details</span>
              <IconButton 
                onClick={() => setDetailsOpen(false)}
                sx={{ p: 1 }}
              >
                <CancelIcon />
              </IconButton>
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
                    </Typography>                    <Box 
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        color: '#64748b',
                        fontSize: '0.875rem',
                        cursor: selectedRequest.studentEmail ? 'pointer' : 'default'
                      }}
                      onClick={() => {
                        if (selectedRequest.studentEmail) {
                          navigator.clipboard.writeText(selectedRequest.studentEmail);
                          setTooltipOpen(true);
                          setTimeout(() => setTooltipOpen(false), 1500);
                        }
                      }}
                    >
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        {selectedRequest.studentEmail || 'No email provided'}
                      </Typography>
                      {selectedRequest.studentEmail && (
                        <Tooltip 
                          title={tooltipOpen ? "Copied!" : "Click to copy"} 
                          placement="right" 
                          open={tooltipOpen} 
                          arrow
                        >
                          <ContentCopyIcon 
                            sx={{ 
                              ml: 0.5, 
                              fontSize: '0.875rem',
                              opacity: 0.7,
                              '&:hover': {
                                opacity: 1
                              }
                            }} 
                          />
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                </Box>
              </Box>
              
              <Box sx={{ mb: 3 }}>                <Typography
                  variant="body2"
                  sx={{ 
                    color: '#64748b',
                    fontWeight: 500,
                    mb: 1,
                    fontFamily: 'var(--font-nunito)'
                  }}
                >
                  CLASS
                </Typography>
                <Typography 
                  sx={{ 
                    fontWeight: 600,
                    color: '#0f172a',
                    fontFamily: 'var(--font-gilroy)'
                  }}
                >
                  {classroomMap[selectedRequest.classroomId]?.name || 'Unknown Class'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', fontFamily: 'var(--font-nunito)' }}>
                  {formatDate(selectedRequest.date)}
                </Typography>
              </Box>
              
              <Box sx={{ mb: 3 }}>                <Typography
                  variant="body2"
                  sx={{ 
                    color: '#64748b',
                    fontWeight: 500,
                    mb: 1,
                    fontFamily: 'var(--font-nunito)'
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
                  <Typography sx={{ color: '#334155', lineHeight: 1.6, fontFamily: 'var(--font-nunito)' }}>
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
              p: { xs: 2, sm: 3 },
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: { xs: 'stretch', sm: 'space-between' },
              gap: { xs: 2, sm: 0 }
            }}>              <Button
                fullWidth={true}
                variant="outlined"
                color="error"
                disabled={isRejecting || isApproving}
                startIcon={isRejecting ? <CircularProgress size={20} color="error" /> : <CancelIcon />}
                onClick={() => handleRejectExcuse(selectedRequest.id)}
                sx={{
                  textTransform: 'none',
                  borderRadius: '8px',
                  borderColor: '#f87171',
                  color: '#ef4444',
                  px: 3,
                  py: { xs: 1.2, sm: 1 },
                  order: { xs: 2, sm: 1 }, // On mobile, this button appears second
                  '&:hover': {
                    borderColor: '#ef4444',
                    bgcolor: 'rgba(239,68,68,0.04)'
                  },
                  '&.Mui-disabled': {
                    borderColor: '#f1f5f9',
                    color: '#94a3b8'
                  }
                }}
              >
                {isRejecting ? 'Processing...' : 'Mark as Absent'}
              </Button>
              
              <Button
                fullWidth={true}
                variant="contained"
                color="primary"
                disabled={isApproving || isRejecting}
                startIcon={isApproving ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
                onClick={() => handleApproveExcuse(selectedRequest.id)}
                sx={{
                  textTransform: 'none',
                  borderRadius: '8px',
                  bgcolor: '#22c55e',
                  color: 'white',
                  px: 3,
                  py: { xs: 1.2, sm: 1 },
                  order: { xs: 1, sm: 2 }, // On mobile, this button appears first (primary action)
                  '&:hover': {
                    bgcolor: '#16a34a'
                  },
                  '&.Mui-disabled': {
                    bgcolor: '#e2e8f0',
                    color: '#94a3b8'
                  }
                }}
              >
                {isApproving ? 'Processing...' : 'Approve Excuse'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>      {/* Document Viewer Modal */}      <Dialog        open={documentModalOpen}
        onClose={() => setDocumentModalOpen(false)}
        maxWidth={documentType === 'image' ? false : "lg"}
        fullWidth        PaperProps={{
          sx: {
            borderRadius: '16px',
            bgcolor: 'white',
            overflow: 'hidden',
            height: { xs: 'auto', sm: '90vh' },
            maxHeight: { xs: '95vh', sm: '90vh' },
            m: { xs: 1, sm: 2 }, // Reduce margin on mobile
            width: { 
              xs: 'calc(100% - 16px)', 
              sm: documentType === 'image' ? 'auto' : '90%'
            }, // Wider for all types on desktop
            maxWidth: {
              xs: '100%',
              sm: documentType === 'image' ? '85vw' : '1200px' // Increased max width on desktop
            }
          }
        }}
      ><DialogTitle 
          sx={{ 
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e2e8f0'
          }}
        >
          Document Viewer
          <IconButton 
            onClick={() => setDocumentModalOpen(false)}
            sx={{ p: 1 }}
          >
            <CancelIcon />
          </IconButton>
        </DialogTitle>        <DialogContent sx={{ 
          p: 0, 
          height: { xs: 'auto', sm: '100%' }, 
          display: 'flex', 
          flexDirection: 'column',
          pb: { xs: 0 }, // Remove bottom padding on mobile
          overflow: documentType === 'image' ? 'hidden' : 'auto' // Prevent double scrollbars for images
        }}>{documentLoading && (
            <Box 
              sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 1,
                bgcolor: 'rgba(255,255,255,0.8)',
                borderRadius: '8px',
                p: 2,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            >
              <CircularProgress size={24} />
              <Typography sx={{ ml: 2, color: '#64748b' }}>Loading document...</Typography>
            </Box>
          )}          {documentUrl && (
            <>
              {/* Document content section */}
              {(() => {
                // Image files - always show in viewer regardless of device
                if (documentType === 'image') {
                  return (                    <Box sx={{ 
                      width: '100%', 
                      height: '100%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      bgcolor: '#f8fafc', 
                      overflow: 'auto',
                      p: { xs: 2, sm: 2 },
                      mx: 'auto' // Center the content
                    }}><img
                        src={documentUrl}
                        alt="Document Preview"
                        style={{
                          maxWidth: isMobile ? '100%' : '100%',
                          maxHeight: isMobile ? '70vh' : 'calc(90vh - 130px)', // Adjusted height for desktop
                          width: 'auto',
                          height: 'auto',
                          objectFit: 'contain',
                          borderRadius: 8,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                        }}
                        onLoad={() => setDocumentLoading(false)}
                      />
                    </Box>
                  );
                }
                // PDF files - different handling for mobile vs desktop
                else if (documentType === 'pdf') {
                  if (isMobile) {
                    // Mobile view - show "Open in Browser" button for PDFs
                    return (
                      <Box 
                        sx={{ 
                          width: '100%', 
                          height: '60vh',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          p: 3,
                          textAlign: 'center',
                          bgcolor: '#f8fafc'
                        }}
                      >
                        <Box 
                          component="img"
                          src="/pdf-icon.svg" 
                          alt="PDF Document"
                          sx={{ 
                            width: 80, 
                            height: 80, 
                            opacity: 0.8,
                            mb: 2,
                            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.1))'
                          }}
                          onLoad={() => setDocumentLoading(false)}
                        />
                        <Typography sx={{ fontWeight: 500, mb: 2, color: '#334155', lineHeight: 1.5 }}>
                          PDF documents are better viewed directly in your browser on mobile devices and tablets.
                        </Typography>
                        <Button
                          href={documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="contained"
                          color="primary"
                          size="large"
                          sx={{ 
                            borderRadius: '8px', 
                            textTransform: 'none', 
                            mb: 1.5,
                            py: 1.5,
                            px: 3,
                            fontWeight: 600,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                          }}
                        >
                          Open in Browser
                        </Button>
                      </Box>
                    );
                  } else {
                    // Desktop view - use iframe PDF viewer
                    return (
                      <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
                        <iframe 
                          src={documentUrl}
                          width="100%" 
                          height="100%" 
                          style={{ border: 'none' }} 
                          onLoad={() => setDocumentLoading(false)}
                          title="PDF Preview"
                        />
                      </Box>
                    );
                  }
                } 
                // Other file types (not images or PDFs)
                else {
                  if (isMobile) {
                    // Mobile view for other files
                    return (
                      <Box 
                        sx={{ 
                          width: '100%', 
                          height: '60vh',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          p: 3,
                          textAlign: 'center',
                          bgcolor: '#f8fafc'
                        }}
                      >
                        <Box 
                          component="img"
                          src="/file.svg" 
                          alt="Document"
                          sx={{ 
                            width: 80, 
                            height: 80, 
                            opacity: 0.8,
                            mb: 2,
                            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.1))'
                          }}
                          onLoad={() => setDocumentLoading(false)}
                        />
                        <Typography sx={{ fontWeight: 500, mb: 2, color: '#334155', lineHeight: 1.5 }}>
                          This document type may be better viewed directly in your browser.
                        </Typography>
                        <Button
                          href={documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="contained"
                          color="primary"
                          size="large"
                          sx={{ 
                            borderRadius: '8px', 
                            textTransform: 'none', 
                            mb: 1.5,
                            py: 1.5,
                            px: 3,
                            fontWeight: 600,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                          }}
                        >
                          Open in Browser
                        </Button>
                      </Box>
                    );
                  } else {
                    // Desktop view with iframe
                    return (
                      <Box sx={{ width: '100%', height: '100%' }}>
                        <iframe 
                          src={documentUrl} 
                          width="100%" 
                          height="100%" 
                          style={{ border: 'none' }} 
                          onLoad={() => setDocumentLoading(false)}
                          title="Document Preview"
                        />
                      </Box>
                    );
                  }
                }
              })()}              {/* Document footer with actions */}              <Box sx={{ 
                p: { xs: '16px 16px 8px', sm: 2 }, // Adjusted padding for mobile
                pt: 2, // Keep top padding consistent
                borderTop: '1px solid #e2e8f0', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                bgcolor: 'white',
                flexWrap: { xs: 'wrap', sm: 'nowrap' },
                mt: 'auto' // Push to bottom of flex container
              }}>
                {/* Document type label */}
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: '#64748b', 
                    fontFamily: 'var(--font-nunito)',
                    width: { xs: '100%', sm: 'auto' },
                    mb: { xs: 1, sm: 0 },
                    order: { xs: 1, sm: 1 }
                  }}
                >
                  {documentType === 'pdf' ? 'PDF Document' : 
                   documentType === 'image' ? 'Image' : 'Document'}
                </Typography>
                
                {/* Action buttons */}
                <Box sx={{ 
                  display: 'flex', 
                  gap: 2, 
                  width: { xs: '100%', sm: 'auto' },
                  order: { xs: 2, sm: 2 },
                  mb: { xs: 0, sm: 'inherit' } // Ensure no margin on mobile
                }}>
                  {/* Only show "View in Browser" button for PDF files on mobile */}                  {isMobile && documentType === 'pdf' && (
                    <Button
                      href={documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="outlined"
                      sx={{ 
                        borderRadius: '8px', 
                        textTransform: 'none',
                        flexGrow: 1,
                        py: { xs: 1.5, sm: 1 }, // Slightly taller button on mobile
                        fontSize: { xs: '0.9rem', sm: 'inherit' }, // Slightly larger text on mobile
                        mb: { xs: 0 } // Ensure no bottom margin on mobile
                      }}
                    >
                      View in Browser
                    </Button>
                  )}
                  
                  {/* Download button for all document types */}                  <Button
                    href={documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    variant="contained"
                    color="primary"
                    sx={{ 
                      borderRadius: '8px', 
                      textTransform: 'none',
                      flexGrow: 1,
                      py: { xs: 1.5, sm: 1 }, // Slightly taller button on mobile
                      fontSize: { xs: '0.9rem', sm: 'inherit' }, // Slightly larger text on mobile
                      mb: { xs: 0 } // Ensure no bottom margin on mobile
                    }}
                  >
                    Download
                  </Button>
                </Box>
              </Box>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}