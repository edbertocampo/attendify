"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "../../../lib/firebase";
import { getAvatarStyles, getInitials } from "../../../lib/avatarUtils";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  deleteDoc,
  query,
  where,
  updateDoc,
  onSnapshot,
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
  Avatar,
} from "@mui/material";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import SchoolIcon from "@mui/icons-material/School";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SettingsIcon from "@mui/icons-material/Settings";
import { signOut, onAuthStateChanged } from "firebase/auth";
import NotificationCenter from "../../../components/NotificationCenter";
import LoadingOverlay from "../../../components/LoadingOverlay";
import AddIcon from "@mui/icons-material/Add";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Fab from "@mui/material/Fab";
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  const [navigating, setNavigating] = useState(false);
  const [enrolledClasses, setEnrolledClasses] = useState<ClassData[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string>("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  const isMobile = typeof window !== 'undefined' && (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  );

  // For mobile: track which card is being long-pressed for drag
  const [mobileDragId, setMobileDragId] = useState<string | null>(null);
  const longPressTimeout = useRef<NodeJS.Timeout | null>(null);

  // Mobile long-press handlers
  const handleTouchStart = (id: string) => {
    if (!isMobile) return;
    longPressTimeout.current = setTimeout(() => {
      setMobileDragId(id);
    }, 400); // 400ms long-press
  };
  const handleTouchEnd = () => {
    if (!isMobile) return;
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
    setMobileDragId(null);
  };
  const handleTouchMove = () => {
    if (!isMobile) return;
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
  };

  // Fetch authenticated student ID and full name
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: any) => {
      if (user) {
        setStudentId(user.uid);
        
        try {
          // Fetch student's full name from Firestore
          const studentRef = doc(db, "users", user.uid);
          const studentDoc = await getDoc(studentRef);
          if (studentDoc.exists()) {
            const userData = studentDoc.data();
            setFullName(userData.fullName || "Unknown Student");
            setProfileImage(userData.profileImage || null);
          } else {
            setFullName("Unknown Student");
          }

          // Fetch saved classroom order
          let savedOrder: string[] | null = null;
          if (studentDoc.exists() && studentDoc.data().classOrder) {
            savedOrder = studentDoc.data().classOrder;
          }

          // Fetch classes
          const q = collection(db, "students");
          const querySnapshot = await getDocs(q);
          let classes = await Promise.all(
            querySnapshot.docs
              .filter((doc: any) => doc.data().studentId === user.uid)
              .map(async (docSnap: any) => {
                // Fetch subjects for this class
                const subjectsQuery = query(
                  collection(db, 'subjects'),
                  where('classCode', '==', docSnap.data().classCode),
                  where('isArchived', 'in', [false, null])
                );
                const subjectsSnapshot = await getDocs(subjectsQuery);
                const subjects = subjectsSnapshot.docs.map((subDoc: any) => ({
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

          // If saved order exists, sort classes accordingly
          if (savedOrder) {
            classes = [...classes].sort((a, b) => {
              const idxA = savedOrder!.indexOf(a.id);
              const idxB = savedOrder!.indexOf(b.id);
              if (idxA === -1) return 1;
              if (idxB === -1) return -1;
              return idxA - idxB;
            });
          }

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

  // Store classroom listeners for cleanup
  const classroomUnsubscribes = useRef<{ [classCode: string]: () => void }>({});

  // Real-time classroom details listener
  useEffect(() => {
    if (!studentId) return;
    let unsubStudent: (() => void) | null = null;

    // Listen to the student's enrolled classes in real time
    const q = collection(db, "students");
    unsubStudent = onSnapshot(q, async (querySnapshot) => {
      const filteredDocs = querySnapshot.docs.filter((doc) => doc.data().studentId === studentId);
      const classCodes = filteredDocs.map((doc) => doc.data().classCode);
      const classIds = filteredDocs.map((doc) => doc.id);
      const fullNames = filteredDocs.map((doc) => doc.data().fullName);
      // Remove listeners for classes no longer enrolled
      Object.keys(classroomUnsubscribes.current).forEach((code) => {
        if (!classCodes.includes(code)) {
          classroomUnsubscribes.current[code]();
          delete classroomUnsubscribes.current[code];
        }
      });
      // Listen to each classroom in real time
      classCodes.forEach((classCode, idx) => {
        if (!classroomUnsubscribes.current[classCode]) {
          const classRef = doc(db, 'classrooms', classCode);
          classroomUnsubscribes.current[classCode] = onSnapshot(classRef, async (classDoc) => {
            if (classDoc.exists()) {
              const data = classDoc.data() as any;
              // Fetch subjects for this class
              const subjectsQuery = query(
                collection(db, 'subjects'),
                where('classCode', '==', classCode),
                where('isArchived', 'in', [false, null])
              );
              const subjectsSnapshot = await getDocs(subjectsQuery);
              const subjects = subjectsSnapshot.docs.map((subDoc: any) => ({
                code: subDoc.id,
                ...subDoc.data()
              }));
              setEnrolledClasses((prev) => {
                // Replace or add the updated class
                const filtered = prev.filter((c) => c.classCode !== classCode);
                return [...filtered, {
                  id: classIds[idx],
                  classCode,
                  className: data.name,
                  fullName: fullNames[idx],
                  subjects,
                  schedule: data.schedule,
                  sessions: Array.isArray(data.sessions) ? data.sessions : undefined,
                }];
              });
            }
          });
        }
      });
      // Remove classes that are no longer enrolled
      setEnrolledClasses((prev) => prev.filter((c) => classCodes.includes(c.classCode)));
    });
    return () => {
      if (unsubStudent) unsubStudent();
      Object.values(classroomUnsubscribes.current).forEach((unsub) => unsub());
      classroomUnsubscribes.current = {};
    };
  }, [studentId]);

  // Save classroom order to Firestore
  const saveClassOrder = async (order: string[]) => {
    if (!studentId) return;
    try {
      const userRef = doc(db, "users", studentId);
      await updateDoc(userRef, { classOrder: order });
    } catch (err) {
      console.error("Failed to save class order", err);
    }
  };

  // Handle drag end
  const handleDndKitDragEnd = (event: any) => {
    setDragging(false);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = enrolledClasses.findIndex((c) => c.id === active.id);
    const newIndex = enrolledClasses.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(enrolledClasses, oldIndex, newIndex);
    setEnrolledClasses(reordered);
    saveClassOrder(reordered.map((c) => c.id));
  };

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
    // Show loading overlay when navigating to a specific subject
    setNavigating(true);
    router.push(`/dashboard/student/class/${classCode}?subject=${subject.code}`);
  };

  // Add this function to handle classroom click
  const handleClassClick = (classCode: string) => {
    // Show loading overlay when navigating
    setNavigating(true);
    router.push(`/dashboard/student/class/${classCode}`);
  };

  // Sortable card component for dnd-kit
  interface SortableClassroomCardProps {
    classData: ClassData;
    idx: number;
    isMobile: boolean;
    mobileDragId: string | null;
    dragging: boolean;
    handleClassClick: (classCode: string) => void;
    handleTouchStart: (id: string) => void;
    handleTouchEnd: () => void;
    handleTouchMove: () => void;
    handleSubjectClick: (classCode: string, subject: Subject) => void;
    handleLeaveClass: (id: string) => void;
  }

  function SortableClassroomCard({
    classData,
    idx,
    isMobile,
    mobileDragId,
    dragging,
    handleClassClick,
    handleTouchStart,
    handleTouchEnd,
    handleTouchMove,
    handleSubjectClick,
    handleLeaveClass,
  }: SortableClassroomCardProps) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: classData.id });
  
    return (
      <Paper
        ref={setNodeRef}
        {...attributes}
        {...((!isMobile || mobileDragId === classData.id) ? listeners : {})}
        elevation={0}
        sx={{
          width: '100%',
          p: { xs: 2.5, sm: 3 },
          minHeight: { xs: "160px", sm: "190px" },
          display: "flex",
          flexDirection: "column",
          borderRadius: '10px', // Less rounded
          border: '1px solid #e5e7eb', // Lighter border
          bgcolor: 'rgba(255,255,255,0.96)', // Softer background
          boxShadow: isDragging ? '0 8px 24px 0 rgba(51,78,172,0.13)' : '0 2px 8px 0 rgba(51,78,172,0.06)',
          transform: CSS.Transform.toString(transform) || 'none',
          zIndex: isDragging ? 1500 : 'auto',
          transition:
            'transform 0.28s cubic-bezier(.4,0,.2,1), box-shadow 0.22s cubic-bezier(.4,0,.2,1), opacity 0.18s cubic-bezier(.4,0,.2,1)',
          cursor: dragging ? 'grab' : 'pointer',
          overflow: 'hidden',
          touchAction: 'manipulation',
          opacity: isDragging ? 0.88 : 1,
        }}
        onClick={() => {
          if (!isMobile || mobileDragId !== classData.id) {
            handleClassClick(classData.classCode);
          }
        }}
        onTouchStart={() => handleTouchStart(classData.id)}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onTouchMove={handleTouchMove}
      >
        <Typography variant="h6" fontWeight={600} color="#334eac" mb={0.5} sx={{ 
            fontSize: 20, 
            letterSpacing: 0.1, 
            fontFamily: 'var(--font-gilroy)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
          {classData.className}
        </Typography>
        <Typography sx={{ color: '#64748b', fontSize: '0.97rem', mb: 1, fontWeight: 400, fontFamily: 'var(--font-nunito)' }}>
          {Array.isArray(classData.sessions) && classData.sessions.length > 0 ? (
            <>
              Schedule:{' '}
              {classData.sessions.map((s, idx) => (
                <span key={idx} style={{ display: 'block', fontSize: '0.97rem', fontFamily: 'var(--font-nunito)' }}>
                  {s.day}: {s.startTime} - {s.endTime}
                </span>
              ))}
            </>
          ) : (
            <>Schedule: {classData.schedule?.startTime || 'N/A'} - {classData.schedule?.endTime || 'N/A'}</>
          )}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          {classData.subjects?.map((subject: Subject) => (
            <Button
              key={subject.code}
              variant="outlined"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleSubjectClick(classData.classCode, subject);
              }}
              sx={{
                borderRadius: '8px', // Less rounded
                textTransform: 'none',
                fontWeight: 500,
                fontSize: 15,
                borderColor: '#e0e0e0',
                color: '#334eac',
                bgcolor: '#f7fafd',
                px: 1.5,
                py: 0.5,
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
            borderRadius: '8px', // Less rounded
            alignSelf: 'flex-end',
            fontWeight: 500,
            fontSize: 13,
            borderColor: '#fbe9e7',
            color: '#ea4335',
            px: 1.5,
            py: 0.5,
            '&:hover': { borderColor: '#ea4335', bgcolor: '#fbe9e7' },
          }}
          startIcon={<ExitToAppIcon />}
        >
          Leave
        </Button>
      </Paper>
    );
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

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
          width: { xs: '70px', md: '220px' }, // slightly less wide for a sleeker look
          bgcolor: "#f9fafb", // lighter, more Apple-like
          borderRight: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          py: 2,
          px: { xs: 1, md: 2 },
          position: "fixed",
          height: "100vh",
          zIndex: 10,
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
            startIcon={<SchoolIcon />}
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
            disabled
          >
            <Typography
              sx={{
                display: { xs: 'none', md: 'block' },
                fontWeight: 500,
                fontFamily: 'var(--font-gilroy)'
              }}
            >
              My Classes
            </Typography>
          </Button>
        </Box>
        
        {/* Bottom Navigation */}
        <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: 1, px: 1 }}>
          <Button
            startIcon={<SettingsIcon />}
            onClick={() => router.push('/settings')}
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
        </Box>
        
        <Box sx={{ width: "100%" }}>
          <Button
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
            sx={{
              justifyContent: 'flex-start',
              color: '#ea4335',
              borderRadius: '8px',
              py: { xs: 1, md: 1.2 },
              px: { xs: 1.2, md: 1.7 },
              minWidth: 0,
              width: '100%',
              fontWeight: 500,
              fontSize: { xs: '0.97rem', md: '1.01rem' },
              background: 'none',
              '&:hover': { bgcolor: '#fbe9e7' },
            }}
          >
            <Typography sx={{ display: { xs: 'none', md: 'inline' }, fontFamily: 'var(--font-gilroy)' }}>Sign Out</Typography>
          </Button>
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
          bgcolor: '#f7fafd', // even lighter for Apple feel
        }}
      >
        {loading && <LoadingOverlay isLoading={loading} message="Loading your classes..." />}
        {navigating && <LoadingOverlay isLoading={navigating} message="Opening classroom..." />}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mb: 3
        }}>
          <Typography variant="h4" fontWeight={700} color="#334eac" sx={{ letterSpacing: 0.5, fontFamily: 'var(--font-gilroy)' }}>
            Welcome, {fullName || "Student"}!
          </Typography>
          
          {/* Notification Center */}
          {studentId && <NotificationCenter userId={studentId} />}
        </Box>
        {/* Enrolled Classes Grid with DragDropContext */}
        {loading ? (
          <CircularProgress />
        ) : enrolledClasses.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={() => setDragging(true)}
            onDragEnd={handleDndKitDragEnd}
          >
            <SortableContext
              items={enrolledClasses.map((c: any) => c.id)}
              strategy={rectSortingStrategy}
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, 1fr)",
                    md: "repeat(3, 1fr)"
                  },
                  gap: 3,
                  mb: 4,
                  minHeight: 100,
                  maxWidth: '100%',
                  px: { xs: 0, sm: 2 },
                  transition: 'all 0.2s cubic-bezier(.4,0,.2,1)',
                  overflow: 'hidden',
                }}
              >
                {enrolledClasses.map((classData: ClassData, idx: number) => (
                  <SortableClassroomCard
                    key={classData.id}
                    classData={classData}
                    idx={idx}
                    isMobile={isMobile}
                    mobileDragId={mobileDragId}
                    dragging={dragging}
                    handleClassClick={handleClassClick}
                    handleTouchStart={handleTouchStart}
                    handleTouchEnd={handleTouchEnd}
                    handleTouchMove={handleTouchMove}
                    handleSubjectClick={handleSubjectClick}
                    handleLeaveClass={handleLeaveClass}
                  />
                ))}
              </Box>
            </SortableContext>
          </DndContext>
        ) : (
          <Typography sx={{ mt: 2, color: '#64748b', fontFamily: 'var(--font-nunito)' }}>
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
          <DialogTitle sx={{ fontWeight: 700, color: '#334eac', fontSize: 22, letterSpacing: 0.1, borderRadius: '8px', fontFamily: 'var(--font-gilroy)' }}>Join a Class</DialogTitle>
          <DialogContent sx={{ p: 2.5 }}>
            <TextField
              label="Enter Class Code"
              variant="outlined"
              value={classCode}
              onChange={(e) => setClassCode(e.target.value)}
              sx={{ mt: 1, minWidth: 280, borderRadius: '8px' }}
              autoFocus
            />
          </DialogContent>
          <DialogActions sx={{ px: 2.5, pb: 2 }}>
            <Button onClick={() => setJoinDialogOpen(false)} color="secondary" sx={{ borderRadius: '8px', fontWeight: 500 }}>Cancel</Button>
            <Button
              onClick={async () => {
                await handleJoinClass();
                setJoinDialogOpen(false);
              }}
              variant="contained"
              color="primary"
              sx={{ fontWeight: 600, borderRadius: '8px', bgcolor: '#334eac', px: 2.5, '&:hover': { bgcolor: '#22336b' } }}
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
