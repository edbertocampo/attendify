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
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import UploadFileIcon from '@mui/icons-material/UploadFile';

interface Subject {
  code: string;
  name: string;
  instructor: string;
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
    type: 'success' | 'error' | 'info' | null;
    message: string;
  }>({ type: null, message: '' });
  const [useFrontCamera, setUseFrontCamera] = useState(true);

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

      let graceEndTime: Date | undefined;
      // If this is an attendance submission (not excuse), check time
      if (attendanceImage) {
        setSubmitStatus({
          type: 'info',
          message: 'Checking attendance time...'
        });

        const schedule = classData.schedule;
        if (!schedule || !schedule.startTime24 || !schedule.endTime24) {
          setSubmitStatus({
            type: 'error',
            message: 'No schedule has been set for this class. Please contact your instructor.'
          });
          return;
        }

        const [startHour, startMinute] = schedule.startTime24.split(':').map(Number);
        const [endHour, endMinute] = schedule.endTime24.split(':').map(Number);
        
        const classStartTime = new Date();
        classStartTime.setHours(startHour, startMinute, 0);
        
        const classEndTime = new Date();
        classEndTime.setHours(endHour, endMinute, 0);
        
        graceEndTime = new Date(classStartTime.getTime() + 15 * 60000); // Add 15 minutes

        // Check if outside class hours for attendance submission
        if (now < classStartTime || now > classEndTime) {
          setSubmitStatus({
            type: 'error',
            message: `Attendance can only be submitted between ${schedule.startTime} - ${schedule.endTime}`
          });
          return;
        }
      }

      // Determine attendance status
      let status;
      if (attendanceImage) {
        status = graceEndTime && now <= graceEndTime ? 'present' : 'late';
      } else if (excuse) {
        status = 'excused';
      } else {
        status = 'absent';
      }

      setSubmitStatus({
        type: 'info',
        message: 'Saving attendance record...'
      });

      // Add attendance record to Firestore
      const attendanceRef = collection(db, 'attendance');
      await addDoc(attendanceRef, {
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
        isLate: status === 'late'
      });

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
      
    } catch (error) {
      console.error('Error submitting attendance:', error);
      setSubmitStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to submit attendance'
      });
    }
  };

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
      backgroundColor: '#f4f6f8',
      p: { xs: 2, sm: 3 },
    }}>
      <Paper 
        elevation={3} 
        sx={{ 
          maxWidth: '1200px',
          margin: '0 auto',
          minHeight: 'calc(100vh - 48px)',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box sx={{ 
          p: 3, 
          borderBottom: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton onClick={() => router.back()} sx={{ mr: 2 }}>
              <ArrowBackIcon />
            </IconButton>
            <Box>
              <Typography variant="h5" fontWeight="bold">
                {className}
              </Typography>
              {currentSubject && (
                <Typography variant="subtitle1" color="text.secondary">
                  {currentSubject.name} - {currentSubject.instructor}
                </Typography>
              )}
            </Box>
          </Box>
        </Box>

        {/* Main Content */}
        <Box sx={{ p: 3 }}>
          {submitStatus.type && (
            <Box sx={{ mb: 3 }}>
              <Alert 
                severity={submitStatus.type}
                action={
                  submitStatus.type === 'success' && (
                    <Button 
                      color="inherit" 
                      size="small"
                      onClick={() => router.push('/dashboard/student')}
                    >
                      Return to Dashboard
                    </Button>
                  )
                }
              >
                {submitStatus.message}
              </Alert>
            </Box>
          )}

          <Box sx={{ maxWidth: '800px', margin: '0 auto' }}>
            <Typography variant="h6" gutterBottom>
              Submit Attendance
            </Typography>

            <Box sx={{ mb: 4 }}>
              <Button
                variant="contained"
                startIcon={<CameraAltIcon />}
                onClick={() => setIsCameraOpen(true)}
                fullWidth
                sx={{ 
                  mb: 2,
                  height: '56px',
                  fontSize: '1.1rem'
                }}
              >
                Take Attendance Photo
              </Button>
              {attendanceImage && (
                <Box sx={{ 
                  mt: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  overflow: 'hidden',
                  position: 'relative',
                  paddingTop: '75%', // 4:3 aspect ratio
                }}>
                  <img 
                    src={attendanceImage} 
                    alt="Attendance Proof" 
                    style={{ 
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block'
                    }}
                  />
                  <Box sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    p: 1,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    justifyContent: 'flex-end'
                  }}>
                    <Button
                      variant="contained"
                      size="small"
                      color="error"
                      onClick={() => {
                        setAttendanceImage(null);
                        setSubmitStatus({ type: null, message: '' });
                      }}
                      sx={{ mr: 1 }}
                    >
                      Remove
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => setIsCameraOpen(true)}
                    >
                      Retake
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>

            <Box sx={{ 
              mt: 4,
              p: 3,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              backgroundColor: 'background.paper'
            }}>
              <Typography variant="h6" gutterBottom>
                Submit Excuse Letter
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                If you're unable to attend class, please submit an excuse letter explaining your absence. 
                Your instructor will review it and mark your attendance as either excused or absent.
              </Typography>

              <TextField
                fullWidth
                multiline
                rows={4}
                label="Excuse Letter Content"
                placeholder="Please explain the reason for your absence in detail..."
                value={excuse}
                onChange={(e) => setExcuse(e.target.value)}
                sx={{ mb: 3 }}
              />

              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handleFileUpload}
              />

              <Button
                variant="outlined"
                startIcon={<UploadFileIcon />}
                onClick={() => fileInputRef.current?.click()}
                fullWidth
                sx={{ mb: 2 }}
              >
                Upload Supporting Document (Medical certificate, etc.)
              </Button>

              {excuseFile && (
                <Box sx={{ 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                  p: 1,
                  borderRadius: 1,
                  bgcolor: 'action.hover'
                }}>
                  <Typography variant="body2" color="text.secondary">
                    {excuseFile.name}
                  </Typography>
                  <Button 
                    size="small" 
                    color="error"
                    onClick={() => {
                      setExcuseFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    Remove
                  </Button>
                </Box>
              )}
            </Box>

            <Button
              variant="contained"
              color="primary"
              fullWidth
              onClick={handleSubmitAttendance}
              sx={{
                mt: 4,
                fontWeight: 'bold',
                borderRadius: '12px',
                height: '56px',
                fontSize: '1.1rem'
              }}
            >
              Submit Attendance
            </Button>
          </Box>
        </Box>

        {/* Replace the Camera Modal with the dynamic component */}
        {isCameraOpen && (
          <CameraModal
            open={isCameraOpen}
            onClose={() => {
              setIsCameraOpen(false);
            }}
            onCapture={(imageUrl: string) => {
              setAttendanceImage(imageUrl);
              setIsCameraOpen(false);
              setSubmitStatus({
                type: 'success',
                message: 'Image captured successfully. Click Submit Attendance to complete.'
              });
            }}
            classCode={classCode}
          />
        )}
      </Paper>
    </Box>
  );
};

export default ClassroomPage;