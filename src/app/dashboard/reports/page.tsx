"use client";

import { useEffect, useState } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Card, 
  CardContent, 
  Button,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Badge,
  Snackbar,
  Alert,
  Fade
} from '@mui/material';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  PieChart, 
  Pie, 
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { db, auth } from '../../../lib/firebase';
import { collection, getDocs, query, where, orderBy, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import HomeIcon from '@mui/icons-material/Home';
import PeopleIcon from '@mui/icons-material/People';
import DescriptionIcon from '@mui/icons-material/Description';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import DownloadIcon from '@mui/icons-material/Download';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LoadingOverlay from '../../../components/LoadingOverlay';
import { generateAttendanceSheet } from '../../../lib/generateAttendanceSheet';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

interface AttendanceRecord {
  classCode: string;
  studentId: string;
  studentName: string;
  subject: string;
  timestamp: Date;
  status: 'present' | 'late' | 'excused' | 'absent';
  submittedTime: Date;
}

interface MonthlyAttendance {
  month: string;
  attendance: number;
}

interface SubjectDistribution {
  name: string;
  students: number;
}

interface FilteredAttendanceRecord {
  timestamp: Date;
  subject: string;
  status: 'present' | 'late' | 'excused' | 'absent';
  isLate?: boolean;
  classCode: string;
}

interface ClassroomData {
  id: string;
  name: string;
  subject: string;
  createdBy?: string;
}

// Custom hook to handle dropdown state and block background interaction
const useDropdownScrollLock = () => {
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  
  // Block all interaction when dropdown is open
  useEffect(() => {
    if (!document) return;
    
    if (isSelectOpen) {
      // Save the current scroll position
      const scrollY = window.scrollY;
      
      // Apply the class that prevents scrolling
      document.body.classList.add('menu-open');
      
      // Create backdrop overlay to capture all clicks outside menu
      const backdrop = document.createElement('div');
      backdrop.className = 'dropdown-backdrop';
      backdrop.id = 'dropdown-backdrop';
      
      // Close dropdown when clicking backdrop
      backdrop.addEventListener('click', () => setIsSelectOpen(false));
      
      document.body.appendChild(backdrop);
      
      // Fix body position to prevent content jump
      document.body.style.top = `-${scrollY}px`;
    } else {
      // Get the scroll position from the body's top property
      const scrollY = document.body.style.top;
      
      // Remove blocking classes
      document.body.classList.remove('menu-open');
      document.body.style.top = '';
      
      // Remove backdrop if it exists
      const backdrop = document.getElementById('dropdown-backdrop');
      if (backdrop) {
        backdrop.removeEventListener('click', () => setIsSelectOpen(false));
        backdrop.parentNode?.removeChild(backdrop);
      }
      
      // Restore scroll position
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0', 10) * -1);
      }
    }
    
    return () => {
      // Cleanup
      document.body.classList.remove('menu-open');
      document.body.style.top = '';
      
      const backdrop = document.getElementById('dropdown-backdrop');
      if (backdrop) {
        backdrop.removeEventListener('click', () => setIsSelectOpen(false));
        backdrop.parentNode?.removeChild(backdrop);
      }
    };
  }, [isSelectOpen]);
  
  return { isSelectOpen, setIsSelectOpen };
};

export default function ReportsPage() {
  const router = useRouter();
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalClasses, setTotalClasses] = useState(0);
  const [averageAttendance, setAverageAttendance] = useState(0);
  const [attendanceData, setAttendanceData] = useState<MonthlyAttendance[]>([]);
  const [subjectData, setSubjectData] = useState<SubjectDistribution[]>([]);
  const [attendanceChange, setAttendanceChange] = useState(0);
  const [studentsChange, setStudentsChange] = useState(0);
  const [classesChange, setClassesChange] = useState(0);
  const [timeFilter, setTimeFilter] = useState('today');
  const [statusData, setStatusData] = useState<any[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<string>('all');
  const [classrooms, setClassrooms] = useState<ClassroomData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [classroomToDownload, setClassroomToDownload] = useState<string>('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [downloadingData, setDownloadingData] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [rangeMode, setRangeMode] = useState<'single' | 'week' | 'month' | 'custom'>('single');
  const [pendingRequests, setPendingRequests] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Add global style for body when menu is open
  useEffect(() => {
    // Create a style element
    const styleElement = document.createElement('style');
    styleElement.innerHTML = `
      body.menu-open {
        overflow: hidden !important;
        position: fixed !important;
        width: 100% !important;
        height: 100% !important;
        touch-action: none !important;
        -webkit-overflow-scrolling: none !important;
        overscroll-behavior: none !important;
        pointer-events: auto !important;
      }
      
      .dropdown-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: transparent;
        z-index: 9990;
        touch-action: none;
        pointer-events: auto;
      }
    `;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);
  
  // Use our custom hook to manage dropdown state and scroll locking
  const { isSelectOpen, setIsSelectOpen } = useDropdownScrollLock();

  // Handle Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleTimeFilterChange = (event: React.MouseEvent<HTMLElement>, newFilter: string) => {
    if (newFilter !== null) {
      setTimeFilter(newFilter);
    }
  };

  const handleClassroomChange = (event: any) => {
    setSelectedClassroom(event.target.value);
  };
  // Open the download dialog for a specific classroom
  const openDownloadDialog = () => {
    if (selectedClassroom === 'all') {
      setSnackbarMessage('Please select a specific classroom to download attendance records.');
      setSnackbarOpen(true);
      return;
    }
    setClassroomToDownload(selectedClassroom);
    // Set range mode based on timeFilter
    if (timeFilter === 'weekly') setRangeMode('week');
    else if (timeFilter === 'monthly') setRangeMode('month');
    else setRangeMode('single');
    setDownloadDialogOpen(true);
  };

  // Close the download dialog
  const closeDownloadDialog = () => {
    setDownloadDialogOpen(false);
  };

  // Handle date change for download
  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(event.target.value);
    setDateRange({ start: event.target.value, end: event.target.value });
  };
  const handleRangeChange = (field: 'start' | 'end', value: string) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  };
  const handleRangeModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setRangeMode(event.target.value as any);
  };

  // Convert data to CSV format
  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return '';
    
    // CSV header
    const header = ['Student ID', 'Student Name', 'Subject', 'Status', 'Time Recorded'];
    
    // Create CSV rows
    const csvRows = [
      header.join(','),
      ...data.map(row => [
        row.studentId,
        `"${row.studentName}"`,
        `"${row.subject}"`,
        row.status,
        new Date(row.timestamp).toLocaleTimeString()
      ].join(','))
    ];
    
    return csvRows.join('\n');
  };

  // Download attendance records
  const downloadAttendanceRecords = async () => {
    if (!classroomToDownload) return;
    setDownloadingData(true);
    try {
      let startTime: Date, endTime: Date;
      if (rangeMode === 'single') {
        const selectedDateObj = new Date(selectedDate);
        startTime = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate());
        endTime = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate(), 23, 59, 59);
      } else {
        // Use dateRange for week, month, custom
        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59);
      }
      // Query attendance records for the selected range and classroom
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('classCode', '==', classroomToDownload),
        where('timestamp', '>=', startTime),
        where('timestamp', '<=', endTime),
        orderBy('timestamp', 'asc')
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      // Format the attendance records
      const attendanceRecords = attendanceSnapshot.docs.map(doc => ({
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate(),
        id: doc.id
      })) as Array<{ studentName: string; status: string; timestamp: Date; id: string }>;
      if (attendanceRecords.length === 0) {
        alert("No attendance records found for the selected range.");
        setDownloadingData(false);
        return;
      }
      // Get classroom and instructor info
      const classroom = classrooms.find(c => c.id === classroomToDownload);
      const className = classroom?.name || 'Classroom';
      let instructor = 'Instructor';
      // Fetch instructor name from users collection using classroom.createdBy as document ID
      if (classroom && (classroom as any).createdBy) {
        try {
          const userDocRef = doc(db, 'users', (classroom as any).createdBy);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            instructor = userData.fullName || 'Instructor';
          }
        } catch (e) {
          // fallback to default instructor
        }
      }
      // Use range as time label
      let timeLabel = '';
      if (rangeMode === 'single') timeLabel = selectedDate;
      else timeLabel = `${dateRange.start} to ${dateRange.end}`;
      // Build unique date list in range
      const allDatesSet = new Set<string>();
      attendanceRecords.forEach(row => {
        if (row.timestamp instanceof Date && !isNaN(row.timestamp.getTime())) {
          allDatesSet.add(row.timestamp.toISOString().slice(0, 10));
        }
      });
      const allDates = Array.from(allDatesSet).sort();
      // Debug: log attendanceRecords to verify studentName
      console.log('Attendance Records for Export:', attendanceRecords);
      // Prepare attendance data for sheet with date
      const sheetData = attendanceRecords.map(row => ({
        studentName: row.studentName || '',
        status: row.status.charAt(0).toUpperCase() + row.status.slice(1),
        date: row.timestamp instanceof Date && !isNaN(row.timestamp.getTime()) ? row.timestamp.toISOString().slice(0, 10) : ''
      }));
      generateAttendanceSheet(sheetData, {
        className,
        instructor,
        time: timeLabel,
        dates: allDates
      });
      closeDownloadDialog();
    } catch (error) {
      console.error("Error downloading attendance records:", error);
      alert("Failed to download attendance records. Please try again.");
    } finally {
      setDownloadingData(false);
    }
  };

  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let startDate = today;
    
    switch (timeFilter) {
      case 'weekly':
        startDate = new Date(today.setDate(today.getDate() - 7));
        break;
      case 'monthly':
        startDate = new Date(today.setMonth(today.getMonth() - 1));
        break;
      default:
        startDate = today;
    }
    
    return { startDate, endDate: new Date() };
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const user = auth.currentUser;
        if (!user) {
          router.push('/login');
          return;
        }
        setUserId(user.uid);

        // Get all classes where the user is an instructor
        const classesQuery = query(
          collection(db, 'classes'),
          where('instructorId', '==', user.uid),
          where('isArchived', '==', false)
        );
        const classesSnapshot = await getDocs(classesQuery);
        console.log('Classes snapshot size:', classesSnapshot.size);

        // Query non-archived classrooms
        const classroomsQuery = query(
          collection(db, 'classrooms'),
          where('isArchived', '==', false)
        );
        const classroomsSnapshot = await getDocs(classroomsQuery);
        console.log('Classrooms snapshot size:', classroomsSnapshot.size);

        // Process classroom data
        const classroomData: ClassroomData[] = classroomsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || '',
          subject: doc.data().subject || '',
          createdBy: doc.data().createdBy || ''
        }));
        setClassrooms(classroomData);

        // Fetch all collections for other metrics
        const studentsSnapshot = await getDocs(collection(db, 'students'));
        const classesSnapshotAll = await getDocs(collection(db, 'classrooms'));
        
        // Fetch attendance for current and previous month
        const currentDate = new Date();
        const firstDayCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const firstDayLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        
        const attendanceQuery = query(
          collection(db, 'attendance'),
          where('timestamp', '>=', firstDayLastMonth),
          orderBy('timestamp', 'desc')
        );
        const attendanceSnapshot = await getDocs(attendanceQuery);

        // Set basic metrics
        const currentStudents = studentsSnapshot.size;
        setTotalStudents(currentStudents);
        
        const currentClasses = classesSnapshotAll.size;
        setTotalClasses(currentClasses);

        // Process attendance records
        const attendanceRecords: AttendanceRecord[] = attendanceSnapshot.docs.map(doc => ({
          classCode: doc.data().classCode || '',
          studentId: doc.data().studentId || '',
          studentName: doc.data().studentName || '',
          subject: doc.data().subject || '',
          status: doc.data().status || 'absent',
          timestamp: doc.data().timestamp?.toDate() || new Date(),
          submittedTime: doc.data().submittedTime?.toDate() || new Date()
        }));

        // Calculate current and previous month metrics
        const currentMonthRecords = attendanceRecords.filter(record => 
          record.timestamp >= firstDayCurrentMonth
        );
        const lastMonthRecords = attendanceRecords.filter(record => 
          record.timestamp >= firstDayLastMonth && record.timestamp < firstDayCurrentMonth
        );

        // Calculate average attendance for current month
        const presentCount = currentMonthRecords.filter(record => 
          record.status === 'present' || record.status === 'late'
        ).length;
        const avgAttendance = currentMonthRecords.length > 0 
          ? (presentCount / currentMonthRecords.length * 100)
          : 0;
        setAverageAttendance(Math.round(avgAttendance));

        // Calculate attendance change
        const lastMonthPresent = lastMonthRecords.filter(record => 
          record.status === 'present' || record.status === 'late'
        ).length;
        const lastMonthAvg = lastMonthRecords.length > 0 
          ? (lastMonthPresent / lastMonthRecords.length * 100)
          : 0;
        const attendanceChangeValue = lastMonthAvg > 0 
          ? ((avgAttendance - lastMonthAvg) / lastMonthAvg) * 100
          : 0;
        setAttendanceChange(Math.round(attendanceChangeValue * 10) / 10);

        // Calculate students change (mock data for now since we don't track historical student counts)
        setStudentsChange(5);
        
        // Calculate classes change (mock data for now since we don't track historical class counts)
        setClassesChange(12);

        // Generate monthly attendance data for the graph
        const last6Months = Array.from({ length: 6 }, (_, i) => {
          const date = new Date();
          date.setMonth(date.getMonth() - (5 - i));
          return date;
        });

        const monthlyData = last6Months.map(date => {
          const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
          const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
          
          const monthRecords = attendanceRecords.filter(record => 
            record.timestamp >= monthStart && record.timestamp <= monthEnd
          );

          const monthlyPresent = monthRecords.filter(record => 
            record.status === 'present' || record.status === 'late'
          ).length;

          return {
            month: date.toLocaleString('default', { month: 'short' }),
            attendance: monthRecords.length > 0 
              ? Math.round((monthlyPresent / monthRecords.length) * 100)
              : 0
          };
        });
        setAttendanceData(monthlyData);

        // Generate classroom distribution data
        const classroomMap = new Map<string, Set<string>>();
        currentMonthRecords.forEach(record => {
          if (!classroomMap.has(record.classCode)) {
            classroomMap.set(record.classCode, new Set());
          }
          classroomMap.get(record.classCode)?.add(record.studentId);
        });

        const classroomDistribution = Array.from(classroomMap.entries())
          .map(([name, students]) => ({
            name: classrooms.find(c => c.id === name)?.name || name,
            students: students.size
          }))
          .sort((a, b) => b.students - a.students)
          .slice(0, 4); // Show top 4 classrooms

        setSubjectData(classroomDistribution);

        const { startDate, endDate } = getDateRange();
        
        const filteredAttendanceQuery = query(
          collection(db, 'attendance'),
          where('timestamp', '>=', startDate),
          where('timestamp', '<=', endDate),
          orderBy('timestamp', 'desc')
        );

        const filteredAttendanceSnapshot = await getDocs(filteredAttendanceQuery);
        const filteredAttendanceRecords = filteredAttendanceSnapshot.docs.map(doc => ({
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate(),
          status: doc.data().status || 'absent',
          isLate: doc.data().isLate || false,
          classCode: doc.data().classCode || ''
        })) as FilteredAttendanceRecord[];

        // Filter by classroom if needed
        const filteredRecords = selectedClassroom === 'all'
          ? filteredAttendanceRecords
          : filteredAttendanceRecords.filter(record => record.classCode === selectedClassroom);

        // Calculate status distribution
        const statusCounts = {
          present: 0,
          late: 0,
          absent: 0,
          excused: 0
        };

        filteredRecords.forEach(record => {
          if (record.isLate) statusCounts.late++;
          else if (record.status === 'present') statusCounts.present++;
          else if (record.status === 'excused') statusCounts.excused++;
          else statusCounts.absent++;
        });

        setStatusData([
          { status: 'Present', count: statusCounts.present, color: '#4CAF50' },
          { status: 'Late', count: statusCounts.late, color: '#FFC107' },
          { status: 'Absent', count: statusCounts.absent, color: '#F44336' },
          { status: 'Excused', count: statusCounts.excused, color: '#9E9E9E' }
        ]);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [timeFilter, selectedClassroom, router]);

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

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f8fafc' }}>
      <LoadingOverlay isLoading={isLoading} message="Loading dashboard data..." />
      
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
      >        {/* Logo */}
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
            onClick={() => router.push('/dashboard/instructor')}
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
          >            <Typography
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
          >            <Typography
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
            sx={{
              justifyContent: 'flex-start',
              color: '#0066cc',
              bgcolor: 'rgba(0,102,204,0.08)',
              borderRadius: '8px',
              py: { xs: 1, md: 1.2 },
              px: { xs: 1.2, md: 1.7 },
              minWidth: 0,
              width: '100%',
              fontWeight: 500,
              fontSize: { xs: '1rem', md: '1.05rem' },
              '&:hover': { bgcolor: 'rgba(0,102,204,0.12)' },
              '& .MuiButton-startIcon': { 
                margin: 0,
                mr: { xs: 0, md: 1.5 },
                minWidth: { xs: 22, md: 'auto' }
              }
            }}
          >            <Typography
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
                '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
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
                '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
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
                Sign Out
              </Typography>
            </Button>
          </Box>
        </Box>
      </Box>      {/* Main Content */}      <Box sx={{ 
        flexGrow: 1, 
        ml: { xs: '70px', md: '220px' }, 
        p: { xs: 1.25, sm: 2, md: 4 }, 
        bgcolor: '#f7fafd',
        maxWidth: { xs: 'calc(100% - 70px)', md: 'calc(100% - 220px)' },
        overflow: 'hidden',
        boxSizing: 'border-box',
        width: '100%'
      }}><Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'column', md: 'row' }, 
          justifyContent: 'space-between', 
          alignItems: { xs: 'flex-start', sm: 'flex-start', md: 'center' }, 
          mb: { xs: 2.5, sm: 3, md: 4 }, 
          gap: { xs: 1.5, sm: 1.5 }, 
          width: '100%', 
          overflow: 'hidden',
          flexWrap: { xs: 'wrap', sm: 'wrap', md: 'nowrap' }
        }}><Box sx={{ 
            mb: { xs: 2, md: 0 },
            width: { xs: '100%', md: 'auto' },
            flexShrink: 1
          }}>
            <Typography variant="h4" sx={{ 
              fontWeight: 700, 
              color: '#1e293b', 
              mb: 0.5, 
              fontFamily: 'var(--font-gilroy)',
              fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' }
            }}>
              Analytics Dashboard
            </Typography>
            <Typography sx={{ 
              color: '#64748b', 
              fontSize: { xs: '0.875rem', sm: '0.925rem', md: '1rem' }, 
              fontWeight: 400, 
              fontFamily: 'var(--font-nunito)',
              pr: { xs: 0, md: 4 }
            }}>
              Insights and trends for your classrooms
            </Typography>          </Box>{/* Controls section - optimized for mobile and tablet */}          <Box sx={{ 
            display: 'flex',            flexDirection: { xs: 'column', sm: 'column', md: 'row' }, 
            gap: { xs: 1.5, sm: 2, md: 1.5 }, // Reduced gap on desktop
            width: '100%',
            maxWidth: '100%',
            flexWrap: { xs: 'nowrap', sm: 'nowrap', md: 'nowrap' },
            alignItems: { xs: 'stretch', sm: 'stretch', md: 'center' },
            justifyContent: { xs: 'flex-start', md: 'flex-start' }, // Changed to flex-start to avoid pushing items apart
            // Changed to column for iPad Pro and similar tablet sizes (around 1024px width)
            '@media (min-width: 900px) and (max-width: 1200px)': {
              flexDirection: 'column',
              flexWrap: 'nowrap',
              alignItems: 'stretch',
              gap: 2
            },
            '@media (min-width: 600px) and (max-width: 900px) and (orientation: portrait)': {
              flexDirection: 'column',
              gap: 2
            },
            '@media (min-width: 600px) and (max-width: 900px) and (orientation: landscape)': {
              flexDirection: 'row',
              flexWrap: 'nowrap',
              gap: 2
            },
            '@media (max-width: 380px)': {
              gap: 1.2
            }
          }}>{/* First row on mobile/tablet: Classroom selector and time filter */}            <Box sx={{ 
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row', md: 'row' },
              gap: { xs: 1.5, sm: 1.5, md: 2 }, 
              width: '100%', 
              justifyContent: { xs: 'flex-start', sm: 'space-between', md: 'flex-start' },
              flexWrap: { xs: 'wrap', sm: 'nowrap', md: 'nowrap' },
              maxWidth: { xs: '100%', sm: '100%', md: '70%' }, // Reduced from 75% to leave more room for the download button
              alignItems: 'flex-start',
              px: { xs: 0.25, sm: 0, md: 0 },
              overflow: 'visible',
              flexShrink: 1, // Allow shrinking as needed
              '@media (min-width: 900px) and (max-width: 1200px)': {
                maxWidth: '100%', // Changed from 65% to 100% for iPad Pro to use full width
                flexWrap: 'nowrap',
                gap: 2.5, // Increased gap between elements
              },
              '@media (min-width: 600px) and (max-width: 900px) and (orientation: portrait)': {
                flexDirection: 'row',
                flexWrap: 'nowrap',
                gap: 1.5,
                maxWidth: '100%'
              },
              '@media (min-width: 600px) and (max-width: 900px) and (orientation: landscape)': {
                maxWidth: '70%',
                flexWrap: 'nowrap'
              },
              '@media (max-width: 380px)': {
                gap: 1.25,
                flexDirection: 'column'
              }
            }}>              <FormControl sx={{ 
                minWidth: { xs: '100%', sm: '40%', md: '180px' }, // Reduced from 200px to 180px
                maxWidth: { xs: '100%', sm: '42%', md: '220px' }, // Reduced from 250px to 220px
                flexGrow: { xs: 0, md: 0 },
                flexShrink: 0,
                flexBasis: { md: '200px' }, // Reduced from 220px to 200px
                // Medium desktop screens need more compact design
                '@media (min-width: 900px) and (max-width: 1200px)': {
                  minWidth: '160px',
                  maxWidth: '200px',
                  flexBasis: '180px',
                },
                '@media (max-width: 380px)': { // Special handling for smallest screens like iPhone SE
                  minWidth: '100%',
                  maxWidth: '100%',
                },
                '@media (max-width: 340px)': { // Extra small screens
                  minWidth: '100%',
                  maxWidth: '100%',
                }
              }}>
                <InputLabel sx={{ 
                  fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' },
                  overflow: 'visible',
                  '@media (max-width: 380px)': {
                    fontSize: '0.7rem'
                  }
                }}>Classroom</InputLabel>                <Select
                  value={selectedClassroom}
                  label="Classroom"
                  onChange={handleClassroomChange}
                  size="small"
                  open={isSelectOpen}
                  onOpen={() => setIsSelectOpen(true)}
                  onClose={() => setIsSelectOpen(false)}                  MenuProps={{
                    // Force scroll locking - critical setting
                    disableScrollLock: false,
                    // Set container to document.body to ensure proper positioning
                    container: document.body,
                    // Menu paper styling with high z-index
                    PaperProps: {
                      style: { 
                        zIndex: 10000, // Very high z-index
                        maxHeight: '300px',
                        position: 'absolute',
                      }
                    },
                    sx: {
                      pointerEvents: 'auto', // Ensure menu receives pointer events
                      '& .MuiPaper-root': {
                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                        borderRadius: '8px',
                        mt: 0.5,
                        overflow: 'auto',
                      },
                      // Modal styling with high z-index
                      '&.MuiModal-root': {
                        zIndex: 10000,
                        // Full backdrop that intercepts all clicks
                        '& .MuiBackdrop-root': {
                          backgroundColor: 'rgba(0, 0, 0, 0.01)', // Almost invisible but captures clicks
                          opacity: '1 !important',
                          backdropFilter: 'blur(1px)', // Very subtle blur effect
                          pointerEvents: 'auto' // Force pointer events to be captured
                        }
                      }
                    },
                    // Backdrop settings to block all interaction
                    BackdropProps: { 
                      invisible: false, // Make backdrop visible
                      transitionDuration: 0, // Remove transition delay
                      sx: { 
                        backgroundColor: 'rgba(0, 0, 0, 0.01)', 
                        zIndex: 9999,
                        pointerEvents: 'auto' // Force capture all pointer events
                      },
                      onClick: () => setIsSelectOpen(false) // Close on backdrop click
                    },
                    // Disable auto focus to prevent keyboard popup on mobile
                    disableAutoFocusItem: true,
                    // Positioning settings
                    anchorOrigin: {
                      vertical: 'bottom',
                      horizontal: 'left'
                    },
                    transformOrigin: {
                      vertical: 'top',
                      horizontal: 'left'
                    },
                    // Use fade transition
                    TransitionComponent: Fade,
                    // Important settings for positioning stability
                    keepMounted: false, // Don't keep mounted to force proper rerendering
                    disablePortal: false, // Use portal for proper stacking context
                    // Important to make menu close when clicked outside
                    slotProps: {
                      backdrop: {
                        onClick: () => setIsSelectOpen(false)
                      }
                    }
                  }}
                  sx={{
                    height: { xs: '32px', sm: '32px', md: '36px' },
                    '& .MuiSelect-select': {
                      fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' },
                      py: { xs: 0.5, sm: 0.6, md: 'auto' },
                      '@media (max-width: 380px)': {
                        fontSize: '0.7rem',
                        py: 0.4
                      }
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#e5e7eb'
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(51, 78, 172, 0.5)'
                    },
                    '& .MuiSelect-icon': {
                      width: { xs: '0.9em', sm: '1em' }
                    }
                  }}
                >
                  <MenuItem value="all">All Classrooms</MenuItem>
                  {classrooms.map((classroom) => (
                    <MenuItem 
                      key={classroom.id} 
                      value={classroom.id}
                      sx={{ 
                        fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' },
                        '@media (max-width: 380px)': {
                          fontSize: '0.7rem'
                        }
                      }}
                    >
                      {classroom.name}
                    </MenuItem>
                  ))}
                </Select>              </FormControl>              <Box sx={{
                flexGrow: 0, 
                width: { xs: '100%', sm: '57%', md: '250px' }, // Reduced width on desktop from 300px to 250px
                maxWidth: { xs: '100%', sm: '58%', md: '280px' }, // Reduced max width from 350px to 280px
                minWidth: { xs: '100%', sm: '235px', md: '220px' }, // Reduced min width from 280px to 220px
                overflow: 'visible', // Changed from hidden to visible to prevent cut-off
                mt: { xs: 0.5, sm: 0 },
                ml: { xs: 0, sm: 0, md: 2 }, // Add margin left in desktop view for spacing from dropdown
                // Medium desktop screens - more compact design
                '@media (min-width: 900px) and (max-width: 1200px)': {
                  width: '280px', // Increased from 220px to 280px for iPad Pro
                  maxWidth: '280px', // Increased from 220px to 280px
                  minWidth: '230px', // Increased from 200px to 230px
                },
                // Added specific width for specific small screens
                '@media (max-width: 400px)': {
                  width: '100%',
                  minWidth: '100%'
                }
              }}><ToggleButtonGroup
                  value={timeFilter}
                  exclusive
                  onChange={handleTimeFilterChange}
                  size="small"
                  sx={{ 
                    display: 'flex',
                    bgcolor: 'white', 
                    borderRadius: 2, 
                    boxShadow: 'none', 
                    border: '1px solid #e5e7eb',
                    width: '100%',
                    minWidth: 0,
                    // Medium desktop screens - more compact design
                    '@media (min-width: 900px) and (max-width: 1200px)': {
                      '& .MuiToggleButton-root': {
                        px: { md: 1 }, // Reduced horizontal padding 
                        fontSize: '0.75rem', // Smaller font size
                      }
                    },
                    overflow: 'visible', // Changed from hidden to visible to prevent cut-off
                    alignItems: 'stretch',
                    height: { xs: '38px', md: '42px' }, // Increased height for desktop
                    '& .MuiToggleButton-root': {
                      flex: 1, // Equal width for all buttons
                      minHeight: { xs: 38, sm: 38, md: 42 }, // Increased height for desktop
                      margin: 0,
                      height: '100%',
                      maxWidth: { xs: '33.33%', md: '33.33%' }, // Keep equal width
                      minWidth: { xs: '33.33%', md: '80px' }, // Ensure minimum width on desktop
                      overflow: 'visible', // Changed from hidden to visible to prevent cut-off
                    },
                    '& .MuiToggleButtonGroup-grouped': {
                      fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.875rem' }, // Larger font on desktop
                      textAlign: 'center',
                      overflow: 'visible', // Changed from hidden to visible
                      lineHeight: { xs: 1, md: 1.2 }, // Better line height on desktop
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      fontWeight: 500,
                      padding: { xs: '4px 2px', sm: '6px 6px', md: '8px 16px' }, // Increased padding for desktop
                      // Very small screens
                      '@media (max-width: 340px)': { 
                        fontSize: '0.65rem',
                        letterSpacing: '-0.02em',
                        padding: '4px 0',
                      },
                      '&:not(:first-of-type)': {
                        borderLeft: '1px solid rgba(0, 0, 0, 0.12) !important'
                      },
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(51, 78, 172, 0.1)',
                        color: '#334eac',
                        fontWeight: 600
                      }
                    }
                  }}
                >                  <ToggleButton value="today" sx={{ 
                    px: { xs: 1, sm: 1.5, md: 2 }, // Adjusted padding horizontally for desktop
                    '@media (min-width: 900px) and (max-width: 1200px)': {
                      px: 0.75, // Reduced padding for iPad Pro
                    }
                  }}>
                    Today
                  </ToggleButton>
                  <ToggleButton value="weekly" sx={{ 
                    px: { xs: 1, sm: 1.5, md: 2 }, // Adjusted padding horizontally for desktop
                    '@media (min-width: 900px) and (max-width: 1200px)': {
                      px: 0.75, // Reduced padding for iPad Pro
                    }
                  }}>
                    Week
                  </ToggleButton>
                  <ToggleButton value="monthly" sx={{ 
                    px: { xs: 1, sm: 1.5, md: 2 }, // Adjusted padding horizontally for desktop
                    '@media (min-width: 900px) and (max-width: 1200px)': {
                      px: 0.75, // Reduced padding for iPad Pro
                    }
                  }}>
                    Month
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>            </Box>              {/* Second row on mobile/tablet: Download button */}            <Box sx={{
              width: { xs: '100%', sm: '190px', md: 'auto' }, 
              display: 'flex', // Always display
              justifyContent: { xs: 'stretch', sm: 'flex-end', md: 'flex-end' },
              mt: { xs: 2, sm: 2, md: 0 },
              ml: { xs: 0, sm: 0, md: 'auto' },
              flexShrink: 0,
              order: { xs: 2, sm: 2, md: 2 }, // Ensure consistent order in the flex layout
              flexBasis: { xs: '100%', sm: 'auto', md: 'auto' }, // Better flex behavior
              '@media (min-width: 600px) and (max-width: 900px) and (orientation: portrait)': {
                justifyContent: 'flex-end',
                width: 'auto', // Auto width for better responsiveness in portrait
                minWidth: '120px', // Minimum width to ensure visibility
                maxWidth: '200px', // Maximum width to limit button expansion
                alignSelf: 'flex-end'
              },
              // Specific iPad Pro styling (around 1024px width)
              '@media (min-width: 900px) and (max-width: 1200px)': {
                width: '100%', // Full width on iPad Pro
                justifyContent: 'flex-start', // Align left like the filter above it
                marginLeft: 0, // Remove auto margin
                marginTop: 2 // Add top margin for spacing
              }
            }}>              <Button
                variant="contained"
                startIcon={<DownloadIcon sx={{ fontSize: { xs: '0.9rem', sm: '0.95rem', md: '1rem' } }} />}
                size="small"
                onClick={openDownloadDialog}
                sx={{ 
                  width: { xs: '100%', sm: '190px', md: 'auto' },
                  height: { xs: '36px', sm: '38px', md: '38px' },
                  py: { xs: 0.75, sm: 0.9, md: 1 },
                  px: { xs: 1.75, sm: 2.5, md: 2 },  // Reduced padding on desktop
                  fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.85rem' }, // Slightly smaller font size
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  minWidth: { xs: '100%', sm: '120px', md: '140px' }, // Reduced min-width further
                  maxWidth: { xs: '100%', sm: '220px', md: '200px' }, // Reduced max-width
                  bgcolor: '#334eac',
                  alignSelf: 'flex-end',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(51, 78, 172, 0.25)',
                  display: 'flex', // Always flex
                  visibility: 'visible', // Explicitly set visibility
                  overflow: 'visible', // Ensure no clipping
                  // iPad Pro specific styling (around 1024px width)
                  '@media (min-width: 900px) and (max-width: 1200px)': {
                    minWidth: '200px',
                    width: '250px',
                    maxWidth: '100%',
                    px: 2,
                    fontSize: '0.8rem',
                    alignSelf: 'flex-start', // Align with left edge when below filter
                    '& .MuiButton-startIcon': {
                      mr: 1.2,
                      minWidth: 'auto'
                    }
                  },
                  '@media (min-width: 600px) and (max-width: 900px)': {
                    width: 'auto',
                    minWidth: '120px'
                  },
                  '&:hover': {
                    bgcolor: '#22336b',
                    boxShadow: '0 4px 12px rgba(51, 78, 172, 0.35)' // Enhanced shadow on hover
                  },
                  '& .MuiButton-startIcon': {
                    mr: { xs: 1, sm: 1.25, md: 1.5 },
                    ml: { xs: -0.5, sm: -0.25, md: 0 }
                  }
                }}
              >
                Download Records
              </Button>
            </Box>
          </Box>
        </Box>        {/* Key Metrics Cards */}
        <Box sx={{ 
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)'
          },
          gap: { xs: 2, sm: 2.5, md: 3 },
          mb: { xs: 3, sm: 3.5, md: 4 },
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden'
        }}>
          <Paper elevation={0} sx={{ 
            p: { xs: 2, sm: 3 }, 
            borderRadius: '10px', 
            border: '1px solid #e5e7eb', 
            bgcolor: 'rgba(255,255,255,0.96)',
            gridColumn: { xs: 'span 2', sm: 'auto' }, // Full width on extra small devices
            order: { xs: 1, sm: 'auto' }
          }}>
            <Typography sx={{ color: '#64748b', mb: 1, fontSize: '0.75rem', fontFamily: 'var(--font-nunito)' }}>
              Average Attendance
            </Typography>
            <Typography sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' }, fontWeight: 600, color: '#1e293b', fontFamily: 'var(--font-gilroy)' }}>
              {averageAttendance}%
            </Typography>
            <Typography color={attendanceChange >= 0 ? "success.main" : "error.main"} sx={{ mt: 0.5, fontSize: { xs: '0.75rem', sm: '0.95rem' }, fontWeight: 500, fontFamily: 'var(--font-nunito)' }}>
              {attendanceChange >= 0 ? '+' : ''}{attendanceChange}% from last month
            </Typography>
          </Paper>

          <Paper elevation={0} sx={{ 
            p: { xs: 2, sm: 3 }, 
            borderRadius: '10px', 
            border: '1px solid #e5e7eb', 
            bgcolor: 'rgba(255,255,255,0.96)',
            order: { xs: 2, sm: 'auto' }
          }}>
            <Typography sx={{ color: '#64748b', mb: 0.5, fontSize: '0.75rem', fontFamily: 'var(--font-nunito)' }}>
              Total Students
            </Typography>
            <Typography sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' }, fontWeight: 600, color: '#1e293b', fontFamily: 'var(--font-gilroy)' }}>
              {totalStudents}
            </Typography>
            <Typography color={studentsChange >= 0 ? "success.main" : "error.main"} sx={{ mt: 0.5, fontSize: { xs: '0.75rem', sm: '0.95rem' }, fontWeight: 500, fontFamily: 'var(--font-nunito)' }}>
              {studentsChange >= 0 ? '+' : ''}{studentsChange}% from last month
            </Typography>
          </Paper>

          <Paper elevation={0} sx={{ 
            p: { xs: 2, sm: 3 }, 
            borderRadius: '10px', 
            border: '1px solid #e5e7eb', 
            bgcolor: 'rgba(255,255,255,0.96)',
            order: { xs: 3, sm: 'auto' }
          }}>
            <Typography sx={{ color: '#64748b', mb: 0.5, fontSize: '0.75rem', fontFamily: 'var(--font-nunito)' }}>
              Total Classes
            </Typography>
            <Typography sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' }, fontWeight: 600, color: '#1e293b', fontFamily: 'var(--font-gilroy)' }}>
              {totalClasses}
            </Typography>
            <Typography color={classesChange >= 0 ? "success.main" : "error.main"} sx={{ mt: 0.5, fontSize: { xs: '0.75rem', sm: '0.95rem' }, fontWeight: 500, fontFamily: 'var(--font-nunito)' }}>
              {classesChange >= 0 ? '+' : ''}{classesChange}% from last month
            </Typography>
          </Paper>
        </Box>        {/* Status Distribution Chart */}
        <Paper sx={{ 
          p: { xs: 2, sm: 3 }, 
          borderRadius: '10px', 
          border: '1px solid #e5e7eb', 
          bgcolor: 'rgba(255,255,255,0.96)', 
          mb: 3,
          maxWidth: '100%'
        }}>
          <Typography variant="h6" sx={{ 
            fontWeight: 600, 
            color: '#1e293b', 
            mb: { xs: 1.5, sm: 2 },
            fontSize: { xs: '1rem', sm: '1.25rem' }
          }}>
            Attendance Status Distribution
          </Typography>
          <Box sx={{ 
            height: { xs: 220, sm: 300 }, 
            width: '100%',
            mt: { xs: 1, sm: 0 }
          }}>
            <ResponsiveContainer width="99%" height="100%">
              <BarChart 
                data={statusData}
                margin={{ top: 5, right: 0, left: -25, bottom: 5 }}
              >                <XAxis 
                  dataKey="status" 
                  tick={{ fontSize: 10 }}
                  tickMargin={5}
                  tickLine={false}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <YAxis 
                  tick={{ fontSize: 10 }} 
                  tickLine={false}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <RechartsTooltip 
                  contentStyle={{ fontSize: '0.875rem' }} 
                  cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                />                <Legend 
                  wrapperStyle={{ 
                    fontSize: '0.75rem',
                    marginTop: 5,
                    paddingTop: 5
                  }}
                  verticalAlign="bottom"
                  height={36}
                />
                <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>        {/* Charts Section */}
        <Box sx={{ 
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: '2fr 1fr'
          },
          gap: 3,
          mb: 3,
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden'
        }}>
          {/* Attendance Trend Chart */}          <Paper sx={{ 
            p: { xs: 2, sm: 3 }, 
            borderRadius: '10px', 
            border: '1px solid #e5e7eb', 
            bgcolor: 'rgba(255,255,255,0.96)',
            maxWidth: '100%'
          }}>
            <Typography variant="h6" sx={{ 
              fontWeight: 600, 
              color: '#1e293b', 
              mb: { xs: 1.5, sm: 2 },
              fontSize: { xs: '1rem', sm: '1.25rem' }
            }}>
              Attendance Trend
            </Typography>
            <Box sx={{ 
              height: { xs: 220, sm: 300 }, 
              width: '100%',
              mt: { xs: 1, sm: 0 }
            }}>
              <ResponsiveContainer width="99%" height="100%">
                <AreaChart 
                  data={attendanceData}
                  margin={{ top: 5, right: 0, left: -25, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0088FE" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#0088FE" stopOpacity={0}/>
                    </linearGradient>
                  </defs>                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 10 }}
                    tickMargin={5}
                    tickLine={false}
                    axisLine={{ stroke: '#E5E7EB' }}
                    padding={{ left: 10, right: 10 }}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <RechartsTooltip 
                    contentStyle={{ fontSize: '0.875rem' }} 
                    cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="attendance" 
                    stroke="#0088FE" 
                    fillOpacity={1} 
                    fill="url(#colorAttendance)" 
                    name="Attendance %"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Paper>

          {/* Subject Distribution Chart */}          <Paper sx={{ 
            p: { xs: 2, sm: 3 }, 
            borderRadius: '10px', 
            border: '1px solid #e5e7eb', 
            bgcolor: 'rgba(255,255,255,0.96)',
            order: { xs: -1, md: 0 }, // Show before area chart on mobile
            mb: { xs: 3, md: 0 }, // Add margin below on mobile
            mt: { xs: 0, md: 0 },
            maxWidth: '100%'
          }}>
            <Typography variant="h6" sx={{ 
              fontWeight: 600, 
              color: '#1e293b', 
              mb: { xs: 1, sm: 2 },
              fontSize: { xs: '1rem', sm: '1.25rem' }
            }}>
              Subject Distribution
            </Typography>
            <Box sx={{ 
              height: { xs: 200, sm: 300 }, 
              width: '100%',
              mt: { xs: 1, sm: 0 }
            }}>
              <ResponsiveContainer width="99%" height="100%">
                <PieChart margin={{ top: 0, right: 0, bottom: 5, left: 0 }}>
                  <Pie
                    data={subjectData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}                    label={({ name, percent }) => {
                      // Use shorter names for small spaces
                      const displayName = name.length > 8 ? name.substring(0, 8) + '...' : name;
                      return `${displayName} ${(percent * 100).toFixed(0)}%`;
                    }}
                    outerRadius={60}
                    fill="#8884d8"
                    dataKey="students"
                  >
                    {subjectData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ 
                      fontSize: '0.875rem',
                      padding: '8px',
                      borderRadius: '4px',
                      boxShadow: '0px 3px 8px rgba(0, 0, 0, 0.12)'
                    }} 
                    itemStyle={{ padding: '2px 0' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Box>        {/* Download Dialog - optimized for mobile and tablet */}
        <Dialog 
          open={downloadDialogOpen} 
          onClose={closeDownloadDialog} 
          fullWidth
          maxWidth="sm"
          PaperProps={{ 
            sx: { 
              borderRadius: { xs: '12px', sm: '14px' }, 
              bgcolor: 'rgba(255,255,255,0.98)',
              margin: { xs: '10px', sm: '20px', md: 'auto' },
              width: { xs: 'calc(100% - 20px)', sm: 'calc(100% - 40px)', md: 'auto' },
              overflow: 'hidden',
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
              maxHeight: { xs: 'calc(100% - 20px)', sm: 'calc(100% - 40px)', md: 'auto' },
              maxWidth: { xs: '100%', sm: '500px', md: '550px' }
            } 
          }}
        >          <DialogTitle sx={{ 
            pb: { xs: 0.5, sm: 1 },
            pt: { xs: 2, sm: 2.5 },
            px: { xs: 2.5, sm: 3 },
            fontSize: { xs: '1.1rem', sm: '1.2rem', md: '1.25rem' }, 
            fontWeight: 600,
            fontFamily: 'var(--font-gilroy)',
            color: '#1e293b',
            borderBottom: '1px solid rgba(229,231,235,0.8)'
          }}>
            Download Attendance Records
          </DialogTitle>
          <DialogContent sx={{ 
            pt: { xs: 2, sm: 2.5 }, 
            px: { xs: 2.5, sm: 3 },
            overflowY: 'auto'
          }}>
            <Typography variant="body2" sx={{ 
              mb: { xs: 1.5, sm: 2 }, 
              fontSize: { xs: '0.85rem', sm: '0.9rem', md: '0.95rem' },
              color: '#64748b',
              fontFamily: 'var(--font-nunito)'
            }}>
              {rangeMode === 'single' && 'Select a date to download attendance records.'}
              {rangeMode !== 'single' && 'Select a date range to download attendance records.'}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 2.5 } }}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1.5,
                flexWrap: 'nowrap'
              }}>
                <label style={{ 
                  fontWeight: 500, 
                  fontSize: '0.85rem', 
                  marginRight: '8px',
                  color: '#334155',
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-nunito)',
                  minWidth: '50px'
                }}>Mode:</label>
                <select 
                  value={rangeMode} 
                  onChange={handleRangeModeChange}
                  style={{ 
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(0,0,0,0.15)',
                    fontSize: '0.85rem',
                    backgroundColor: '#fff',
                    flexGrow: 1,
                    maxWidth: '100%',
                    fontFamily: 'var(--font-nunito)',
                    color: '#334155'
                  }}
                >
                  <option value="single">Single Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="custom">Custom Range</option>
                </select>
              </Box>
              
              {rangeMode === 'single' && (
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  width: '100%',
                  flexWrap: 'nowrap'
                }}>
                  <CalendarTodayIcon sx={{ 
                    mr: 1.5, 
                    color: 'rgba(100,116,139,0.7)',
                    fontSize: { xs: '0.9rem', sm: '1rem' },
                    flexShrink: 0
                  }} />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={handleDateChange}
                    style={{ 
                      padding: '10px 12px', 
                      borderRadius: '6px', 
                      border: '1px solid rgba(0,0,0,0.15)', 
                      fontSize: '0.85rem',
                      width: '100%',
                      fontFamily: 'var(--font-nunito)',
                      color: '#334155'
                    }}
                  />
                </Box>
              )}
                {rangeMode !== 'single' && (
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', md: 'row' },
                  alignItems: { xs: 'flex-start', md: 'center' }, 
                  gap: { xs: 2, sm: 2.5, md: 2 },
                  width: '100%'
                }}>
                  <Box sx={{ width: '100%' }}>
                    <label style={{ 
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      color: '#334155',
                      fontFamily: 'var(--font-nunito)'
                    }}>Start:</label>
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%'
                    }}>
                      <CalendarTodayIcon sx={{ 
                        mr: 1, 
                        color: 'rgba(100,116,139,0.7)',
                        fontSize: '0.9rem',
                        flexShrink: 0
                      }} />
                      <input
                        type="date"
                        value={dateRange.start}
                        onChange={e => handleRangeChange('start', e.target.value)}
                        style={{ 
                          padding: '8px 10px', 
                          borderRadius: '6px', 
                          border: '1px solid rgba(0,0,0,0.15)', 
                          fontSize: '0.85rem',
                          width: '100%',
                          fontFamily: 'var(--font-nunito)',
                          color: '#334155'
                        }}
                      />
                    </Box>
                  </Box>
                  <Box sx={{ width: '100%' }}>
                    <label style={{ 
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      color: '#334155',
                      fontFamily: 'var(--font-nunito)'
                    }}>End:</label>
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%'
                    }}>
                      <CalendarTodayIcon sx={{ 
                        mr: 1, 
                        color: 'rgba(100,116,139,0.7)',
                        fontSize: '0.9rem',
                        flexShrink: 0
                      }} />
                      <input
                        type="date"
                        value={dateRange.end}
                        onChange={e => handleRangeChange('end', e.target.value)}
                        style={{ 
                          padding: '8px 10px', 
                          borderRadius: '6px', 
                          border: '1px solid rgba(0,0,0,0.15)', 
                          fontSize: '0.85rem',
                          width: '100%',
                          fontFamily: 'var(--font-nunito)',
                          color: '#334155'
                        }}
                      />
                    </Box>
                  </Box>
                </Box>
              )}
            </Box>
          </DialogContent>          <DialogActions sx={{ 
            p: { xs: 2.5, sm: 3 },
            pt: { xs: 2, sm: 2 },
            pb: { xs: 3, sm: 3 },
            flexDirection: { xs: 'column', sm: 'column', md: 'row' },
            gap: { xs: 1, sm: 1, md: 1.5 },
            borderTop: '1px solid rgba(229,231,235,0.8)',
            mt: { xs: 1, sm: 2 },
            justifyContent: { xs: 'center', sm: 'center', md: 'flex-end' }
          }}>            <Button 
              onClick={closeDownloadDialog}
              sx={{ 
                width: { xs: '100%', sm: '100%', md: 'auto' },
                order: { xs: 2, sm: 2, md: 1 },
                mb: { xs: 0, sm: 0 },
                color: '#64748b',
                textTransform: 'none',
                fontSize: '0.85rem',
                fontWeight: 500,
                py: { xs: 0.8, sm: 1, md: 1 },
                px: { xs: 2.5, sm: 4, md: 4 },
                minWidth: { xs: '100%', sm: '100%', md: '110px' }
              }}
            >
              Cancel
            </Button><Button 
              onClick={downloadAttendanceRecords} 
              variant="contained" 
              startIcon={<DownloadIcon sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }} />}
              disabled={downloadingData}
              sx={{ 
                width: { xs: '100%', sm: '100%', md: 'auto' },
                order: { xs: 1, sm: 1, md: 2 },
                mb: { xs: 1, sm: 1, md: 0 },
                bgcolor: '#2563eb',
                textTransform: 'none',
                fontSize: '0.85rem',
                fontWeight: 500,
                py: { xs: 0.8, sm: 1, md: 1 },
                px: { xs: 2.5, sm: 4, md: 4 },
                minWidth: { xs: '100%', sm: '100%', md: '180px' },
                '&:hover': {
                  bgcolor: '#1d4ed8'
                },
                '& .MuiButton-startIcon': {
                  mr: { xs: 1.5, sm: 1.75, md: 2 }
                }
              }}
            >
              {downloadingData ? 'Downloading...' : 'Download'}
            </Button>
          </DialogActions>
        </Dialog>      </Box>

      {/* Snackbar notification */}      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity="info" 
          variant="filled"
          sx={{ 
            width: '100%', 
            alignItems: 'center',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            '& .MuiAlert-message': {
              fontSize: '0.875rem',
              fontFamily: 'var(--font-nunito)'
            }
          }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}