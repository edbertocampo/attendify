"use client";

import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  Modal,
} from '@mui/material';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import axios from 'axios'; // Import axios for MongoDB requests

interface CameraModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (imageUrl: string) => void;
  classCode: string;
}

const CameraModal = ({ open, onClose, onCapture, classCode }: CameraModalProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [useFrontCamera, setUseFrontCamera] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
        throw new Error('Camera not available');
      }

      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: useFrontCamera ? 'user' : 'environment',
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Check if video ref still exists before proceeding
      if (!videoRef.current) {
        mediaStream.getTracks().forEach(track => track.stop());
        return;
      }

      videoRef.current.srcObject = mediaStream;
      setStream(mediaStream);

      // Wait for loadedmetadata event before playing
      await new Promise<void>((resolve) => {
        if (!videoRef.current) {
          resolve();
          return;
        }
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play()
              .then(() => resolve())
              .catch((error) => {
                console.error('Error playing video:', error);
                resolve();
              });
          } else {
            resolve();
          }
        };
      });
    } catch (error) {
      console.error('Error accessing camera:', error);
      onClose();
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setStream(null);
    }
  };

  useEffect(() => {
    if (open) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [open, useFrontCamera]);

  const captureImage = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Could not get canvas context');
      }

      if (useFrontCamera) {
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
      }
      
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const previewDataUrl = canvas.toDataURL('image/jpeg');
      setPreviewUrl(previewDataUrl);
      
      stopCamera();
    }
  };

  const handleSubmit = async () => {
    if (!previewUrl) return;
    onCapture(previewUrl); // Pass the preview URL to parent
    stopCamera();
    setPreviewUrl(null);
    onClose();
  };

  const retakePhoto = () => {
    setPreviewUrl(null);
    startCamera();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        stopCamera();
        setPreviewUrl(null);
        onClose();
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box sx={{ 
        bgcolor: 'background.paper', 
        borderRadius: '16px',
        p: 3,
        width: '95vw',
        maxWidth: '800px',
        outline: 'none',
      }}>
        <Box sx={{ 
          position: 'relative', 
          width: '100%',
          paddingTop: '75%',
          backgroundColor: '#000',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          {!previewUrl ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: useFrontCamera ? 'scaleX(-1)' : 'none',
              }}
            />
          ) : (
            <img
              src={previewUrl}
              alt="Captured preview"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          )}
        </Box>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <Box sx={{ 
          mt: 2, 
          display: 'flex', 
          justifyContent: 'space-between',
          gap: 2
        }}>
          {previewUrl ? (
            <>
              <Button 
                variant="outlined" 
                onClick={retakePhoto} 
                sx={{ flex: 1 }}
              >
                Retake
              </Button>
              <Button 
                variant="outlined" 
                onClick={() => {
                  setPreviewUrl(null);
                  onClose();
                }} 
                sx={{ flex: 1 }}
              >
                Cancel
              </Button>
              <Button 
                variant="contained" 
                onClick={handleSubmit} 
                sx={{ flex: 1 }}
              >
                OK
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outlined" 
                onClick={() => {
                  stopCamera();
                  setUseFrontCamera(!useFrontCamera);
                  startCamera();
                }}
                sx={{ flex: 1 }}
              >
                {useFrontCamera ? 'Use Back Camera' : 'Use Front Camera'}
              </Button>
              <Button 
                variant="outlined" 
                onClick={() => {
                  stopCamera();
                  onClose();
                }} 
                sx={{ flex: 1 }}
              >
                Cancel
              </Button>
              <Button 
                variant="contained" 
                onClick={captureImage} 
                sx={{ flex: 1 }}
              >
                Capture
              </Button>
            </>
          )}
        </Box>
      </Box>
    </Modal>
  );
};

export default CameraModal;