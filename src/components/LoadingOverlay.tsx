import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isLoading, message = 'Loading...' }) => {
  if (!isLoading) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
      }}
    >
      <CircularProgress size={60} sx={{ color: '#1976d2' }} />
      <Typography variant="h6" sx={{ mt: 2, fontWeight: 500, color: '#1976d2' }}>
        {message}
      </Typography>
    </Box>
  );
};

export default LoadingOverlay;