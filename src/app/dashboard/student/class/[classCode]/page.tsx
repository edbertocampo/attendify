"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { db, auth } from '../../../../../lib/firebase';
import { doc, getDoc, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import dynamic from 'next/dynamic';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  CircularProgress,
  TextField,
  Modal,
  Alert,
  Snackbar,
  Tabs,
  Tab,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AttendanceCalendar from '@/components/AttendanceCalendar';
import NotificationCenter from '@/components/NotificationCenter'; // Added import
import { getFirestore } from 'firebase/firestore';
import { createAttendanceSubmissionNotification, createNotification } from '../../../../../lib/notificationService';

interface Subject {
  code: string;
  name: string;
  instructor: string;
}

// Define the type for attendance entries
interface AttendanceEntry {
  date: string;
  type: 'image' | 'file' | 'absent'; // MODIFIED: Added 'absent'
  url?: string; // MODIFIED: Made url optional
  fileName?: string;
  geolocation?: { latitude: number; longitude: number } | null;
}

// Update the dynamic import with proper typing
const CameraModal = dynamic<{
  open: boolean;
  onClose: () => void;
  onCapture: (imageUrl: string) => void;
  classCode: string;
}>(
  () => import('@/app/dashboard/student/class/[classCode]/CameraModal'),
  { 
    ssr: false,
    loading: () => (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        height: '100%' 
      }}>
        <CircularProgress />
      </Box>
    )
  }
);

const ClassroomPage = () => {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const classCode = params.classCode as string;
  const subjectCode = searchParams.get('subject');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [className, setClassName] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [currentSubject, setCurrentSubject] = useState<Subject | null>(null);
  const [excuse, setExcuse] = useState('');
  const [excuseFile, setExcuseFile] = useState<File | null>(null);
  const [attendanceImage, setAttendanceImage] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'error' | 'info' | 'warning' | null;
    message: string;
  }>({ type: null, message: '' });
  const [useFrontCamera, setUseFrontCamera] = useState(true);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [geolocation, setGeolocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);
  const [attendanceEntries, setAttendanceEntries] = useState<AttendanceEntry[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [absenceWarningNotificationProcessed, setAbsenceWarningNotificationProcessed] = useState(false);

  useEffect(() => {
    const fetchClassDetails = async () => {
      if (!classCode) {
        router.push('/dashboard/student');
        return;
      }

      try {
        // Fetch classroom details
        const classRef = doc(db, 'classrooms', classCode);
        const classDoc = await getDoc(classRef);
        
        if (classDoc.exists()) {
          setClassName(classDoc.data().name);
          
          // If we have a subject code, fetch that specific subject
          if (subjectCode) {
            const subjectRef = doc(db, 'subjects', subjectCode);
            const subjectDoc = await getDoc(subjectRef);
            if (subjectDoc.exists()) {
              setCurrentSubject({
                code: subjectDoc.id,
                ...subjectDoc.data()
              } as Subject);
            }
          }
        } else {
          throw new Error('Classroom not found');
        }
      } catch (error) {
        console.error('Error fetching class details:', error);
        setSubmitStatus({
          type: 'error',
          message: 'Error loading classroom details'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchClassDetails();
  }, [classCode, subjectCode, router]);

  // Fetch attendance records for calendar and check for excessive absences
  useEffect(() => {
    const fetchAttendanceRecordsAndCheckAbsences = async () => {
      if (!auth.currentUser || !classCode) return;
      setCalendarLoading(true);
      let currentStudentName = auth.currentUser.displayName || 'Student';
      let currentClassName = className; // Use state for className

      try {
        // Ensure className is resolved before use
        if (!currentClassName) {
          const classRef = doc(db, 'classrooms', classCode as string);
          const classDocSnap = await getDoc(classRef);
          if (classDocSnap.exists()) {
            currentClassName = classDocSnap.data().name || 'This Class';
          } else {
            currentClassName = 'This Class'; // Fallback
          }
        }
        // ... (rest of student name fetching if needed) ...

        const attendanceQuery = query(
          collection(db, 'attendance'),
          where('classCode', '==', classCode),
          where('studentId', '==', auth.currentUser.uid)
        );
        const snapshot = await getDocs(attendanceQuery);
        const entries = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data();
            const recordDate = data.timestamp?.toDate ? data.timestamp.toDate().toISOString().slice(0, 10) : '';
            if (!recordDate) return undefined;
            if (data.status === 'absent' || data.present === false) {
              return {
                date: recordDate,
                type: 'absent',
                geolocation: data.geolocation || null,
              } as AttendanceEntry;
            }
            // ... other types (image, file) ...
            if (data.proofImage) {
              return {
                date: recordDate,
                type: 'image',
                url: data.proofImage,
                geolocation: data.geolocation || null,
              } as AttendanceEntry;
            }
            if (data.excuseFile) {
              return {
                date: recordDate,
                type: 'file',
                url: data.excuseFile,
                fileName: typeof data.excuseFile === 'string' ? data.excuseFile.split('/').pop() : undefined,
                geolocation: data.geolocation || null,
              } as AttendanceEntry;
            }
            return undefined;
          })
          .filter((e: AttendanceEntry | undefined): e is AttendanceEntry => !!e);
        setAttendanceEntries(entries);

        const absenceCount = entries.filter(e => e.type === 'absent').length;
        const shouldDisplayAbsenceWarning = absenceCount >= 3;

        if (shouldDisplayAbsenceWarning) {
          if (!absenceWarningNotificationProcessed) {
            const notificationsRef = collection(db, 'notifications');
            const q = query(
              notificationsRef,
              where('userId', '==', auth.currentUser.uid),
              where('type', '==', 'warning'),
              where('title', '==', 'Absence Warning'),
              where('extraData.classCode', '==', classCode as string)
            );

            const existingNotificationsSnap = await getDocs(q);
            if (existingNotificationsSnap.empty) {
              try {
                await createNotification({
                  userId: auth.currentUser.uid,
                  title: 'Absence Warning',
                  message: `You have ${absenceCount} ${absenceCount === 1 ? 'absence' : 'absences'} in ${currentClassName || 'this class'}. Please communicate with your instructor.`,
                  type: 'warning',
                  extraData: {
                    classCode: classCode as string,
                    className: currentClassName || 'this class',
                  }
                });
              } catch (notificationError) {
                console.error('Failed to create absence warning notification:', notificationError);
              }
            }
            setAbsenceWarningNotificationProcessed(true);
          }
        } else {
          // Condition for warning is not met. Clear the on-page warning and reset the processed flag.
          if (absenceWarningNotificationProcessed) { // Reset only if it was true
             setAbsenceWarningNotificationProcessed(false);
          }
        }

      } catch (e) {
        console.error('Error fetching attendance records for calendar:', e);
        setAttendanceEntries([]);
      } finally {
        setCalendarLoading(false);
      }
    };
    fetchAttendanceRecordsAndCheckAbsences();
  }, [auth.currentUser, classCode, className, subjectCode]); // Removed submitStatus.message, absenceWarningNotificationProcessed is not needed here

  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: useFrontCamera ? 'user' : 'environment',
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      setIsCameraOpen(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      setSubmitStatus({
        type: 'error',
        message: 'Unable to access camera. Please make sure you have granted camera permissions.'
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setStream(null);
    }
    setIsCameraOpen(false);
  };

  const captureImage = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      try {
        const blob = await new Promise<Blob>((resolve) => 
          canvas.toBlob(blob => resolve(blob!), 'image/jpeg', 0.8)
        );

        const storage = getStorage();
        const storageRef = ref(storage, `attendance/${classCode}/${Date.now()}.jpg`);
        
        const uploadTask = await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(uploadTask.ref);
        
        setAttendanceImage(downloadURL);
        stopCamera();
        setSubmitStatus({
          type: 'success',
          message: 'Image captured successfully'
        });
      } catch (error) {
        console.error('Error capturing image:', error);
        setSubmitStatus({
          type: 'error',
          message: 'Failed to capture image'
        });
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setSubmitStatus({
        type: 'error',
        message: 'File size must be less than 5MB'
      });
      return;
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      setSubmitStatus({
        type: 'error',
        message: 'Invalid file type. Please upload a PDF, DOC, DOCX, JPG, or PNG file.'
      });
      return;
    }

    try {
      // Convert file to array buffer for validation
      await file.arrayBuffer();
      setExcuseFile(file);
      setSubmitStatus({
        type: 'info',
        message: 'Excuse file selected: ' + file.name
      });
    } catch (error) {
      console.error('Error processing file:', error);
      setSubmitStatus({
        type: 'error',
        message: 'Error processing file. Please try again with a different file.'
      });
      setExcuseFile(null);
    }
  };

  const handleSubmitAttendance = async () => {
    if (!attendanceImage && !excuse) {
      setSubmitStatus({
        type: 'error',
        message: 'Please either capture attendance or provide an excuse'
      });
      return;
    }

    if (!auth.currentUser) {
      setSubmitStatus({
        type: 'error',
        message: 'You must be logged in to submit attendance'
      });
      return;
    }

    // --- GEOLOCATION CAPTURE ---
    let geo = null;
    try {
      setSubmitStatus({ type: 'info', message: 'Requesting geolocation...' });
      geo = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported by your browser.'));
        } else {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
              });
            },
            (error) => {
              reject(error);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        }
      });
    } catch (geoError) {
      setSubmitStatus({
        type: 'error',
        message: 'Geolocation unavailable or denied. Attendance will be submitted without location.'
      });
      geo = null;
    }
    // --- END GEOLOCATION CAPTURE ---

    try {
      // Get classroom data (needed for both attendance and excuse)
      const classRef = doc(db, 'classrooms', classCode);
      const classDoc = await getDoc(classRef);
      if (!classDoc.exists()) {
        throw new Error('Class not found');
      }

      const classData = classDoc.data();
      const now = new Date();
      
      // Check for existing attendance today for this subject
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('studentId', '==', auth.currentUser.uid),
        where('classCode', '==', classCode),
        where('subject', '==', subjectCode),
        where('timestamp', '>=', today),
        where('timestamp', '<', tomorrow)
      );

      const existingAttendance = await getDocs(attendanceQuery);
      if (!existingAttendance.empty) {
        setSubmitStatus({
          type: 'error',
          message: 'You have already submitted attendance for this subject today'
        });
        return;
      }

      // Get current user's display name
      // Instead of using auth display name, let's fetch the student's real name from the students collection
      let studentName = auth.currentUser.displayName || 'Unknown Student';
      
      try {
        // Query the students collection to get the actual fullName
        const studentQuery = query(
          collection(db, 'students'),
          where('studentId', '==', auth.currentUser.uid),
          where('classCode', '==', classCode)
        );
        
        const studentDocs = await getDocs(studentQuery);
        if (!studentDocs.empty) {
          // Use the fullName from the students collection
          studentName = studentDocs.docs[0].data().fullName || studentName;
        }
      } catch (studentNameError) {
        console.error('Error fetching student name:', studentNameError);
        // Continue with the current name if there was an error
      }

      let excuseFileUrl = null;
      if (excuseFile) {
        setSubmitStatus({
          type: 'info',
          message: 'Uploading supporting document...'
        });

        try {
          // Upload to MongoDB only
          const formData = new FormData();
          formData.append('image', excuseFile);
          formData.append('classCode', classCode);
          formData.append('type', 'excuse');

          const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });

          const responseData = await uploadResponse.json();
          
          if (!uploadResponse.ok) {
            throw new Error(responseData.error || 'Failed to upload file to MongoDB');
          }

          if (!responseData.success || !responseData.mongoUrl) {
            throw new Error('Invalid response from upload service');
          }

          // Store the MongoDB URL directly
          excuseFileUrl = responseData.mongoUrl;
          
          setSubmitStatus({
            type: 'info',
            message: 'Document uploaded successfully, saving attendance record...'
          });
        } catch (uploadError) {
          console.error('Error uploading excuse file:', uploadError);
          setSubmitStatus({
            type: 'error',
            message: uploadError instanceof Error ? uploadError.message : 'Failed to upload supporting document. Please try again.'
          });
          return; // Stop the submission process if upload fails
        }
      }

      // NEW LOGIC FOR STATUS DETERMINATION AND TIME VALIDATION
      // 'now' and 'classData' are already defined and in scope from earlier in the function.
      let determinedStatus: string = '';
      let graceEndTimeForPresentLate: Date | undefined;
      let sessionTimeValidationRequired = false;

      if (attendanceImage) {
        sessionTimeValidationRequired = true;
        // Status ('present' or 'late') will be set after time validation.
      } else if (excuse) {
        determinedStatus = 'excused';
        // No strict time validation needed for excuses for the act of submission itself.
      } else {
        // Neither image nor excuse. If the student reaches this point and submits,
        // it's treated as an active "absent" submission which should be time-bound.
        // The initial check `if (!attendanceImage && !excuse)` at the start of handleSubmitAttendance
        // already prompts the user, so if they proceed, this is the intent.
        determinedStatus = 'absent'; // Tentative status, confirmed if time check passes.
        sessionTimeValidationRequired = true;
      }

      if (sessionTimeValidationRequired) {
        setSubmitStatus({ type: 'info', message: 'Checking attendance time...' });

        const sessions = classData.sessions || [];
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayDay = daysOfWeek[now.getDay()];
        const todaySession = sessions.find((session: any) => session.day === todayDay);

        if (!todaySession) {
          setSubmitStatus({ type: 'error', message: 'No session scheduled for today. Attendance cannot be submitted.' });
          return;
        }

        // Debug session time information
        console.log('Session time data:', {
          day: todayDay,
          startTime: todaySession.startTime,
          endTime: todaySession.endTime,
          timeFormat: todaySession.timeFormat || '24hr' // Check if AM/PM format is specified
        });

        // Parse time strings which may be in different formats
        let startHour, startMinute, endHour, endMinute;
        
        // Function to parse time strings in various formats
        const parseTimeString = (timeStr: string) => {
          // Normalize the time string - remove any extra spaces and make lowercase
          const normalizedTime = timeStr.toLowerCase().trim();
          console.log('Parsing time string:', normalizedTime);
          
          // Case 1: Format like "7 am" or "7 pm" (no minutes)
          if (/^\d+\s*(am|pm)$/.test(normalizedTime)) {
            const match = normalizedTime.match(/^(\d+)\s*(am|pm)$/);
            if (match) {
              let hour = parseInt(match[1], 10);
              const period = match[2];
              
              console.log(`Parsing time: ${hour} ${period}`);
              
              // Adjust for PM
              if (period === 'pm' && hour < 12) {
                hour += 12;
                console.log(`Adjusted to PM: ${hour}`);
              }
              // Adjust for 12 AM
              if (period === 'am' && hour === 12) {
                hour = 0;
                console.log(`Adjusted 12 AM to: ${hour}`);
              }
              
              console.log(`Final parsed value: ${hour}:00`);
              return { hour, minute: 0 };
            }
          }
          
          // Case 2: Format like "7:00 am" or "7:00 pm" (with minutes and space)
          if (/^\d+:\d+\s*(am|pm)$/.test(normalizedTime)) {
            const match = normalizedTime.match(/^(\d+):(\d+)\s*(am|pm)$/);
            if (match) {
              let hour = parseInt(match[1], 10);
              const minute = parseInt(match[2], 10);
              const period = match[3];
              
              // Adjust for PM
              if (period === 'pm' && hour < 12) {
                hour += 12;
              }
              // Adjust for 12 AM
              if (period === 'am' && hour === 12) {
                hour = 0;
              }
              
              return { hour, minute };
            }
          }
          
          // Case 3: Format like "7:00am" or "7:00pm" (with minutes, no space)
          if (/^\d+:\d+(am|pm)$/.test(normalizedTime)) {
            const match = normalizedTime.match(/^(\d+):(\d+)(am|pm)$/);
            if (match) {
              let hour = parseInt(match[1], 10);
              const minute = parseInt(match[2], 10);
              const period = match[3];
              
              console.log(`Parsing time format 3: ${hour}:${minute} ${period}`);
              
              // Adjust for PM
              if (period === 'pm' && hour < 12) {
                hour += 12;
                console.log(`Adjusted to PM: ${hour}`);
              }
              // Adjust for 12 AM
              if (period === 'am' && hour === 12) {
                hour = 0;
                console.log(`Adjusted 12 AM to: ${hour}`);
              }
              
              console.log(`Final parsed value: ${hour}:${minute}`);
              return { hour, minute };
            }
          }
          
          // Case 3b: Format like "7am" or "6pm" (no minutes, no space)
          if (/^\d+(am|pm)$/.test(normalizedTime)) {
            const match = normalizedTime.match(/^(\d+)(am|pm)$/);
            if (match) {
              let hour = parseInt(match[1], 10);
              const period = match[2];
              
              console.log(`Parsing time format 3b: ${hour} ${period}`);
              
              // Adjust for PM
              if (period === 'pm' && hour < 12) {
                hour += 12;
                console.log(`Adjusted to PM: ${hour}`);
              }
              // Adjust for 12 AM
              if (period === 'am' && hour === 12) {
                hour = 0;
                console.log(`Adjusted 12 AM to: ${hour}`);
              }
              
              console.log(`Final parsed value: ${hour}:00`);
              return { hour, minute: 0 };
            }
          }
          
          // Case 4: Standard 24-hour format like "7:00" or "18:00"
          if (/^\d+:\d+$/.test(normalizedTime)) {
            const [hourStr, minuteStr] = normalizedTime.split(':');
            return {
              hour: parseInt(hourStr, 10),
              minute: parseInt(minuteStr, 10)
            };
          }
          
          // Case 5: Just a number (assume it's an hour with 0 minutes)
          if (/^\d+$/.test(normalizedTime)) {
            return {
              hour: parseInt(normalizedTime, 10),
              minute: 0
            };
          }
          
          // If no format matches, try a generic approach as a fallback
          console.warn('Unrecognized time format, attempting fallback parsing:', timeStr);
          
          // Try to extract numbers and am/pm
          const hourMatch = normalizedTime.match(/(\d+)/);
          const isPM = normalizedTime.includes('pm');
          
          if (hourMatch) {
            let hour = parseInt(hourMatch[1], 10);
            
            // Apply AM/PM logic if detected
            if (isPM && hour < 12) {
              hour += 12;
              console.log(`Fallback: Adjusted to PM: ${hour}`);
            }
            
            if (!isPM && hour === 12) {
              hour = 0;
              console.log(`Fallback: Adjusted 12 AM to: ${hour}`);
            }
            
            console.log(`Fallback parsing result: ${hour}:00`);
            return { hour, minute: 0 };
          }
          
          console.error('Failed to parse time format:', timeStr);
          return { hour: NaN, minute: NaN };
        };
        
        // Parse the start time - handling additional edge cases
        let startTimeParsed;
        try {
          startTimeParsed = parseTimeString(todaySession.startTime);
          
          // Extra validation for common edge cases
          if (isNaN(startTimeParsed.hour)) {
            // Try alternative parsing approach for "7am" (without space)
            const simpleMatch = todaySession.startTime.toLowerCase().match(/(\d+)(am|pm)/);
            if (simpleMatch) {
              let hour = parseInt(simpleMatch[1], 10);
              const period = simpleMatch[2];
              
              if (period === 'pm' && hour < 12) {
                hour += 12;
              }
              if (period === 'am' && hour === 12) {
                hour = 0;
              }
              
              startTimeParsed = { hour, minute: 0 };
              console.log('Emergency parsing for start time worked:', startTimeParsed);
            }
          }
        } catch (e) {
          console.error('Start time parsing error:', e);
          startTimeParsed = { hour: 7, minute: 0 }; // Default to 7am if parsing completely fails
          console.log('Using default start time 7:00');
        }
        
        startHour = startTimeParsed.hour;
        startMinute = startTimeParsed.minute;
        
        // Parse the end time with same robustness
        let endTimeParsed;
        try {
          endTimeParsed = parseTimeString(todaySession.endTime);
          
          // Extra validation for common edge cases
          if (isNaN(endTimeParsed.hour)) {
            // Try alternative parsing approach for "6pm" (without space)
            const simpleMatch = todaySession.endTime.toLowerCase().match(/(\d+)(am|pm)/);
            if (simpleMatch) {
              let hour = parseInt(simpleMatch[1], 10);
              const period = simpleMatch[2];
              
              if (period === 'pm' && hour < 12) {
                hour += 12;
              }
              if (period === 'am' && hour === 12) {
                hour = 0;
              }
              
              endTimeParsed = { hour, minute: 0 };
              console.log('Emergency parsing for end time worked:', endTimeParsed);
            }
          }
        } catch (e) {
          console.error('End time parsing error:', e);
          endTimeParsed = { hour: 18, minute: 0 }; // Default to 6pm if parsing completely fails
          console.log('Using default end time 18:00');
        }
        
        endHour = endTimeParsed.hour;
        endMinute = endTimeParsed.minute;

        console.log('Parsed time values:', {
          start: { hour: startHour, minute: startMinute },
          end: { hour: endHour, minute: endMinute }
        });

        if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {
            console.error('Invalid time format detected:', { startHour, startMinute, endHour, endMinute });
            setSubmitStatus({ type: 'error', message: 'Invalid session time format in class data.' });
            return;
        }

        const classStartTime = new Date(now);
        classStartTime.setHours(startHour, startMinute, 0, 0);
        const classEndTime = new Date(now);
        classEndTime.setHours(endHour, endMinute, 0, 0);
        
        // More detailed time comparison for debugging
        console.log('Time comparison:', {
          now: now.toLocaleTimeString(),
          nowHour: now.getHours(),
          nowMinute: now.getMinutes(),
          nowTimestamp: now.getTime(),
          classStartTime: classStartTime.toLocaleTimeString(),
          classStartHour: classStartTime.getHours(),
          classStartMinute: classStartTime.getMinutes(),
          classStartTimestamp: classStartTime.getTime(),
          classEndTime: classEndTime.toLocaleTimeString(),
          classEndHour: classEndTime.getHours(),
          classEndMinute: classEndTime.getMinutes(),
          classEndTimestamp: classEndTime.getTime(),
          isBeforeStart: now < classStartTime,
          isAfterEnd: now > classEndTime
        });

        if (isNaN(classStartTime.getTime()) || isNaN(classEndTime.getTime())) {
            console.error('Invalid Date objects:', { classStartTime, classEndTime });
            setSubmitStatus({ type: 'error', message: 'Failed to calculate class session times.' });
            return;
        }
        
        // Core check: is 'now' within the session window?
        if (now < classStartTime || now > classEndTime) {
          console.log('Time check failed, outside class hours:', {
            beforeStart: now < classStartTime,
            afterEnd: now > classEndTime,
            nowTime: now.getTime(),
            startTime: classStartTime.getTime(),
            endTime: classEndTime.getTime(),
            timeDiffToStart: classStartTime.getTime() - now.getTime(),
            timeDiffToEnd: now.getTime() - classEndTime.getTime()
          });
          setSubmitStatus({ type: 'error', message: `Attendance can only be submitted between ${todaySession.startTime} - ${todaySession.endTime}` });
          return;
        }
        
        console.log('Time check passed, within class hours');

        // If time validation passed and it was an image submission:
        if (attendanceImage) {
          graceEndTimeForPresentLate = new Date(classStartTime.getTime() + 15 * 60000); // 15 minutes grace period
          determinedStatus = (now <= graceEndTimeForPresentLate) ? 'present' : 'late';
        }
        // If it was an 'absent' submission (no image, no excuse), 
        // determinedStatus is already 'absent' and has now passed the time validation.
      }

      const status = determinedStatus;

      if (!status) {
        // This safeguard implies that none of the paths (image, excuse, or active absent)
        // resulted in a determined status. This should ideally not be reached.
        setSubmitStatus({ type: 'error', message: 'Could not determine attendance status. Please check inputs and try again.' });
        return;
      }
      // END OF NEW LOGIC

      setSubmitStatus({
        type: 'info',
        message: 'Saving attendance record...'
      });

      // Add attendance record to Firestore
      const attendanceRef = collection(db, 'attendance');
      const attendanceDoc = await addDoc(attendanceRef, {
        classCode,
        studentId: auth.currentUser.uid,
        studentName,
        subject: subjectCode,
        timestamp: now,
        excuse: excuse || null,
        excuseFile: excuseFileUrl,
        proofImage: attendanceImage,
        status,
        submittedTime: now,
        isLate: status === 'late',
        geolocation: geo // { latitude, longitude } or null
      });

      // Create notification for the attendance submission
      await createAttendanceSubmissionNotification(
        auth.currentUser.uid,
        status as 'present' | 'late' | 'excused' | 'absent',
        classCode,
        className,
        subjectCode ? currentSubject?.name || null : null,
        attendanceDoc.id,
        now
      );

      setSubmitStatus({
        type: 'success',
        message: status === 'excused' ? 
          'Excuse submitted successfully!' : 
          status === 'late' ? 
            'Attendance submitted (Marked as Late)' : 
            'Attendance submitted successfully!'
      });
      
      // Clear form
      setExcuse('');
      setExcuseFile(null);
      setAttendanceImage(null);
      setSnackbarOpen(true);
      
    } catch (error) {
      console.error('Error submitting attendance:', error);
      setSubmitStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to submit attendance'
      });
      setSnackbarOpen(true);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // Helper function to reverse geocode
  async function fetchPlaceName(lat: number, lon: number) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
      );
      if (!response.ok) return null;
      const data = await response.json();
      return data.display_name || null;
    } catch {
      return null;
    }
  }

  // Count absences for warning/notification
  const absenceCount = attendanceEntries.filter(e => e.type !== 'file' && e.type !== 'image').length;
  // If attendance status is stored, use it for more accuracy
  // const absenceCount = attendanceEntries.filter(e => e.status === 'absent').length;

  if (loading) {
    return (
      <Box sx={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh',
      backgroundColor: '#f7fafd',
      color: '#222',
      p: { xs: 1, sm: 3 },
    }}>
      {/* Header */}
      <Box sx={{ 
        p: { xs: 2, sm: 4 }, 
        borderBottom: '1px solid',
        borderColor: 'divider',
        backgroundColor: '#f7fafd',
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={() => router.back()} sx={{ mr: 2 }} aria-label="Go back">
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start',
            gap: 0.5,
          }}>
            <Typography variant="h4" fontWeight="bold" sx={{ letterSpacing: 1, color: '#222', mb: 0, fontFamily: 'var(--font-gilroy)' }}>
              {className}
            </Typography>
            {currentSubject && (
              <Typography variant="subtitle1" sx={{ color: 'text.secondary', fontWeight: 500, fontFamily: 'var(--font-nunito)' }}>
                {currentSubject.name} - {currentSubject.instructor}
              </Typography>
            )}
          </Box>
        </Box>
        {auth.currentUser && <NotificationCenter userId={auth.currentUser.uid} />} {/* Modified NotificationCenter component */}
      </Box>

      {/* Tabs */}
      <Box sx={{ maxWidth: '800px', margin: '0 auto', mt: 4 }}>
        <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} centered>
          <Tab label="Submit Attendance" />
          <Tab label="Attendance Calendar" />
        </Tabs>
      </Box>

      {/* Main Content */}
      <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: '1200px', margin: '0 auto' }}>
        {/* Absence warning notification */}
        {(absenceCount === 2 || absenceCount >= 3) && (
          <Alert 
            severity={absenceCount >= 3 ? 'error' : 'warning'}
            sx={{ mb: 3, fontWeight: 'bold', fontSize: '1.1rem', borderRadius: 2, fontFamily: 'var(--font-nunito)' }}
          >
            {absenceCount === 2 && 'You are close to having 3 absences. Please be mindful and communicate with your instructor if needed.'}
            {absenceCount >= 3 && 'You have 3 or more absences. Please communicate with your instructor as soon as possible.'}
          </Alert>
        )}
        {tabIndex === 0 && (
          <>
            {submitStatus.type && (
              <Box sx={{ mb: 3 }}>
                <Alert 
                  severity={submitStatus.type || 'info'}
                  iconMapping={{
                    success: <span role="img" aria-label="success">✅</span>,
                    error: <span role="img" aria-label="error">❌</span>,
                    info: <span role="img" aria-label="info">ℹ️</span>
                  }}
                  sx={{ fontSize: '1rem', alignItems: 'center', color: '#222' }}
                >
                  {submitStatus.message}
                </Alert>
              </Box>
            )}
            <Box sx={{ maxWidth: '800px', margin: '0 auto' }}>
              <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 2, color: '#222', fontFamily: 'var(--font-gilroy)' }}>
                Attendance Submission
              </Typography>
              <Box sx={{ mb: 4, p: 3, border: '1px solid #e5e7eb', borderRadius: 2, background: '#f9fafb' }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ color: '#222', fontFamily: 'var(--font-gilroy)' }}>
                  Take Attendance Photo
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontFamily: 'var(--font-nunito)' }}>
                  Please take a clear photo of yourself for attendance. Make sure your face is visible and well-lit.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<CameraAltIcon />}
                  onClick={() => setIsCameraOpen(true)}
                  fullWidth
                  sx={{ 
                    mb: 2,
                    height: '56px',
                    fontSize: { xs: '0.95rem', sm: '1.1rem' },
                    fontWeight: 'bold',
                    borderRadius: '10px',
                    bgcolor: '#334eac',
                    '&:hover': { bgcolor: '#22336b' }
                  }}
                  aria-label="Take attendance photo"
                >
                  Take Attendance Photo
                </Button>
                {attendanceImage && (
                  <Box sx={{ 
                    mt: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 1
                  }}>
                    <img 
                      src={attendanceImage} 
                      alt="Attendance Proof" 
                      style={{ 
                        width: 150,
                        height: 150,
                        objectFit: 'cover',
                        borderRadius: '50%',
                        border: '2px solid #334eac',
                        boxShadow: '0 2px 8px rgba(51,78,172,0.15)'
                      }}
                    />
                    {isLocating ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                        <CircularProgress size={24} sx={{ mr: 1 }} />
                        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'var(--font-nunito)' }}>
                          Fetching location...
                        </Typography>
                      </Box>
                    ) : geolocation && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontFamily: 'var(--font-nunito)' }}>
                        Location: {geolocation.latitude.toFixed(6)}, {geolocation.longitude.toFixed(6)}
                        {placeName && (
                          <span> (<b>{placeName}</b>)</span>
                        )}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                      <Button
                        variant="contained"
                        size="small"
                        color="error"
                        onClick={() => {
                          setAttendanceImage(null);
                          setGeolocation(null);
                          setPlaceName(null);
                          setIsLocating(false);
                          setSubmitStatus({ type: null, message: '' });
                        }}
                        sx={{ borderRadius: 2, fontSize: { xs: '0.85rem', sm: '1rem' } }}
                      >
                        Remove
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => setIsCameraOpen(true)}
                        sx={{ borderRadius: 2, fontSize: { xs: '0.85rem', sm: '1rem' } }}
                      >
                        Retake
                      </Button>
                    </Box>
                  </Box>
                )}
              </Box>

              <Box sx={{ 
                mt: 4,
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                backgroundColor: '#fff',
                mb: 2
              }}>
                <Typography variant="subtitle1" fontWeight={500} gutterBottom sx={{ fontFamily: 'var(--font-gilroy)' }}>
                  Submit Excuse Letter
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Excuse Letter"
                  placeholder="Reason for absence..."
                  value={excuse}
                  onChange={(e) => setExcuse(e.target.value)}
                  sx={{ mb: 2, background: '#fafbfc', borderRadius: 1 }}
                  inputProps={{ 'aria-label': 'Excuse letter content' }}
                />
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  style={{ display: 'none' }}
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  aria-label="Upload supporting document"
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<UploadFileIcon />}
                    onClick={() => fileInputRef.current?.click()}
                    sx={{ borderRadius: 2, minWidth: 0, px: 2, fontSize: { xs: '0.85rem', sm: '1rem' } }}
                    aria-label="Upload supporting document"
                  >
                    Upload
                  </Button>
                  {excuseFile && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'transparent', p: 0 }}>
                      <Typography variant="body2" sx={{ fontSize: 13, color: 'text.secondary', wordBreak: 'break-all', fontFamily: 'var(--font-nunito)' }}>
                        {excuseFile.name}
                      </Typography>
                      <IconButton size="small" color="error" onClick={() => { setExcuseFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} aria-label="Remove uploaded file">
                        ×
                      </IconButton>
                    </Box>
                  )}
                </Box>
                <Box
                  onDrop={e => { e.preventDefault(); if (e.dataTransfer.files && e.dataTransfer.files.length > 0) { handleFileUpload({ target: { files: e.dataTransfer.files } } as any); } }}
                  onDragOver={e => e.preventDefault()}
                  sx={{ border: '1px dashed #bdbdbd', borderRadius: 2, mt: 2, p: 2, textAlign: 'center', color: '#bbb', fontSize: 13, background: '#fafbfc', cursor: 'pointer' }}
                  aria-label="Drag and drop file upload area"
                >
                  Drag & drop file here
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', fontSize: 11, fontFamily: 'var(--font-nunito)' }}>
                  PDF, DOC, DOCX, JPG, PNG. Max 5MB.
                </Typography>
              </Box>

              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={handleSubmitAttendance}
                disabled={loading || (!attendanceImage && !excuse)}
                sx={{
                  mt: 4,
                  fontWeight: 'bold',
                  borderRadius: '12px',
                  height: '56px',
                  fontSize: { xs: '0.95rem', sm: '1.1rem' },
                  bgcolor: '#334eac',
                  '&:hover': { bgcolor: '#22336b' }
                }}
                aria-label="Submit attendance"
              >
                Submit Attendance
              </Button>
            </Box>
          </>
        )}
        {tabIndex === 1 && (
          <Box sx={{ mt: 4 }}>
            {calendarLoading ? (
              <CircularProgress />
            ) : (
              <AttendanceCalendar 
                year={new Date().getFullYear()} 
                month={new Date().getMonth() + 1} 
                entries={attendanceEntries} 
              />
            )}
          </Box>
        )}
      </Box>

      {/* Camera Modal */}
      {isCameraOpen && (
        <CameraModal
          open={isCameraOpen}
          onClose={() => {
            setIsCameraOpen(false);
          }}
          onCapture={async (imageUrl: string) => {
            setAttendanceImage(imageUrl);
            setIsCameraOpen(false);
            setSubmitStatus({
              type: 'success',
              message: 'Image captured successfully. Click Submit Attendance to complete.'
            });
            // Request geolocation after capturing image
            if (navigator.geolocation) {
              setIsLocating(true);
              navigator.geolocation.getCurrentPosition(
                async (position) => {
                  const coords = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                  };
                  setGeolocation(coords);
                  // Fetch place name
                  const name = await fetchPlaceName(coords.latitude, coords.longitude);
                  setPlaceName(name);
                  setIsLocating(false);
                },
                (error) => {
                  setGeolocation(null);
                  setPlaceName(null);
                  setIsLocating(false);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
              );
            } else {
              setGeolocation(null);
              setPlaceName(null);
              setIsLocating(false);
            }
          }}
          classCode={classCode}
        />
      )}

      {/* Snackbar */}
      {(snackbarOpen && !!submitStatus.type) && (
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={4000}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          sx={{
            '& .MuiPaper-root': {
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.98)'
            }
          }}
        >
          <Alert
            severity={submitStatus.type || 'info'}
            iconMapping={{
              success: <span role="img" aria-label="success">✅</span>,
              error: <span role="img" aria-label="error">❌</span>,
              info: <span role="img" aria-label="info">ℹ️</span>
            }}
            onClose={handleSnackbarClose}
            sx={{ fontSize: '1rem', alignItems: 'center', minWidth: 320 }}
          >
            {submitStatus.message}
          </Alert>
        </Snackbar>
      )}
    </Box>
  );
};

export default ClassroomPage;