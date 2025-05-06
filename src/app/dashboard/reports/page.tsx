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
  Tooltip
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
import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
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
  const [downloadingData, setDownloadingData] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [rangeMode, setRangeMode] = useState<'single' | 'week' | 'month' | 'custom'>('single');

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
      alert('Please select a specific classroom to download attendance records.');
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

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f8fafc' }}>
      <LoadingOverlay isLoading={isLoading} message="Loading dashboard data..." />
      
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
      <Box sx={{ flexGrow: 1, ml: { xs: '70px', md: '240px' }, p: { xs: 2, sm: 3, md: 4 } }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 4, gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
              Analytics Dashboard
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: '1rem', fontWeight: 400 }}>
              Insights and trends for your classrooms
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Classroom</InputLabel>
              <Select
                value={selectedClassroom}
                label="Classroom"
                onChange={handleClassroomChange}
                size="small"
              >
                <MenuItem value="all">All Classrooms</MenuItem>
                {classrooms.map((classroom) => (
                  <MenuItem key={classroom.id} value={classroom.id}>
                    {classroom.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <ToggleButtonGroup
              value={timeFilter}
              exclusive
              onChange={handleTimeFilterChange}
              size="small"
              sx={{ bgcolor: 'white', borderRadius: 2, boxShadow: 'none', border: '1px solid #e5e7eb' }}
            >
              <ToggleButton value="today">Today</ToggleButton>
              <ToggleButton value="weekly">Weekly</ToggleButton>
              <ToggleButton value="monthly">Monthly</ToggleButton>
            </ToggleButtonGroup>

            <Tooltip title="Download daily attendance records">
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                size="small"
                onClick={openDownloadDialog}
                sx={{ ml: 1 }}
              >
                Download Records
              </Button>
            </Tooltip>
          </Box>
        </Box>

        {/* Key Metrics Cards */}
        <Box sx={{ 
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)'
          },
          gap: 3,
          mb: 4
        }}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: '16px', border: '1px solid rgba(0,0,0,0.08)', bgcolor: 'white' }}>
            <Typography sx={{ color: '#64748b', mb: 1, fontSize: '0.875rem' }}>
              Total Students
            </Typography>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 600, color: '#1e293b' }}>
              {totalStudents}
            </Typography>
            <Typography color={studentsChange >= 0 ? "success.main" : "error.main"} sx={{ mt: 1, fontSize: '0.95rem', fontWeight: 500 }}>
              {studentsChange >= 0 ? '+' : ''}{studentsChange}% from last month
            </Typography>
          </Paper>

          <Paper elevation={0} sx={{ p: 3, borderRadius: '16px', border: '1px solid rgba(0,0,0,0.08)', bgcolor: 'white' }}>
            <Typography sx={{ color: '#64748b', mb: 1, fontSize: '0.875rem' }}>
              Total Classes
            </Typography>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 600, color: '#1e293b' }}>
              {totalClasses}
            </Typography>
            <Typography color={classesChange >= 0 ? "success.main" : "error.main"} sx={{ mt: 1, fontSize: '0.95rem', fontWeight: 500 }}>
              {classesChange >= 0 ? '+' : ''}{classesChange}% from last month
            </Typography>
          </Paper>

          <Paper elevation={0} sx={{ p: 3, borderRadius: '16px', border: '1px solid rgba(0,0,0,0.08)', bgcolor: 'white' }}>
            <Typography sx={{ color: '#64748b', mb: 1, fontSize: '0.875rem' }}>
              Average Attendance
            </Typography>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 600, color: '#1e293b' }}>
              {averageAttendance}%
            </Typography>
            <Typography color={attendanceChange >= 0 ? "success.main" : "error.main"} sx={{ mt: 1, fontSize: '0.95rem', fontWeight: 500 }}>
              {attendanceChange >= 0 ? '+' : ''}{attendanceChange}% from last month
            </Typography>
          </Paper>
        </Box>

        {/* Status Distribution Chart */}
        <Paper sx={{ p: 3, borderRadius: '16px', border: '1px solid rgba(0,0,0,0.08)', bgcolor: 'white', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 2 }}>
            Attendance Status Distribution
          </Typography>
          <Box sx={{ height: 300, width: '100%' }}>
            <ResponsiveContainer>
              <BarChart data={statusData}>
                <XAxis dataKey="status" />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="count" name="Students">
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>

        {/* Charts Section */}
        <Box sx={{ 
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: '2fr 1fr'
          },
          gap: 3,
          mb: 3
        }}>
          {/* Attendance Trend Chart */}
          <Paper sx={{ p: 3, borderRadius: '16px', border: '1px solid rgba(0,0,0,0.08)', bgcolor: 'white' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 2 }}>
              Attendance Trend
            </Typography>
            <Box sx={{ height: 300, width: '100%' }}>
              <ResponsiveContainer>
                <AreaChart data={attendanceData}>
                  <defs>
                    <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0088FE" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#0088FE" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" />
                  <YAxis domain={[0, 100]} />
                  <RechartsTooltip />
                  <Area 
                    type="monotone" 
                    dataKey="attendance" 
                    stroke="#0088FE" 
                    fillOpacity={1} 
                    fill="url(#colorAttendance)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Paper>

          {/* Subject Distribution Chart */}
          <Paper sx={{ p: 3, borderRadius: '16px', border: '1px solid rgba(0,0,0,0.08)', bgcolor: 'white' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 2 }}>
              Subject Distribution
            </Typography>
            <Box sx={{ height: 300, width: '100%' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={subjectData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="students"
                  >
                    {subjectData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Box>

        {/* Download Dialog */}
        <Dialog open={downloadDialogOpen} onClose={closeDownloadDialog}>
          <DialogTitle>Download Attendance Records</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {rangeMode === 'single' && 'Select a date to download attendance records.'}
              {rangeMode !== 'single' && 'Select a date range to download attendance records.'}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <label>Mode:</label>
                <select value={rangeMode} onChange={handleRangeModeChange}>
                  <option value="single">Single Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="custom">Custom Range</option>
                </select>
              </Box>
              {rangeMode === 'single' && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CalendarTodayIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={handleDateChange}
                    style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.23)', fontSize: '1rem' }}
                  />
                </Box>
              )}
              {rangeMode !== 'single' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box>
                    <label>Start:</label>
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={e => handleRangeChange('start', e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.23)', fontSize: '1rem' }}
                    />
                  </Box>
                  <Box>
                    <label>End:</label>
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={e => handleRangeChange('end', e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.23)', fontSize: '1rem' }}
                    />
                  </Box>
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDownloadDialog}>Cancel</Button>
            <Button 
              onClick={downloadAttendanceRecords} 
              variant="contained" 
              startIcon={<DownloadIcon />}
              disabled={downloadingData}
            >
              {downloadingData ? 'Downloading...' : 'Download'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}