"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserNotifications, Notification, markNotificationAsRead, deleteNotification } from '../../../../lib/notificationService';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Paper,
  Divider,
  Chip,
  Button,
  CircularProgress,
  Alert
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        loadNotifications(user.uid);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const loadNotifications = async (uid: string) => {
    try {
      setLoading(true);
      const result = await getUserNotifications(uid);
      if (result.success && result.notifications) {
        setNotifications(result.notifications);
      } else {
        setError('Failed to load notifications. Please try again later.');
      }
    } catch (err) {
      console.error('Error loading notifications:', err);
      setError('Failed to load notifications. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNotification = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the ListItem click event
    try {
      setIsDeleting(prev => ({ ...prev, [notificationId]: true }));
      await deleteNotification(notificationId);
      setNotifications(notifications.filter(n => n.id !== notificationId));
    } catch (err) {
      console.error('Error deleting notification:', err);
      setError('Failed to delete notification. Please try again.');
    } finally {
      setIsDeleting(prev => ({ ...prev, [notificationId]: false }));
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    try {
      // Mark as read
      if (!notification.read && notification.id) {
        await markNotificationAsRead(notification.id);
        setNotifications(notifications.map(n =>
          n.id === notification.id ? { ...n, read: true } : n
        ));
      }

      // Navigate based on notification type
      if (notification.relatedDoc?.type === 'attendance') {
        router.push(`/dashboard/student/class/${notification.extraData?.classCode}`);
      } else if (notification.relatedDoc?.type === 'excuse') {
        router.push(`/dashboard/student/class/${notification.extraData?.classCode}`);
      }
    } catch (err) {
      console.error('Error handling notification:', err);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon sx={{ color: '#4caf50' }} />;
      case 'error':
        return <ErrorIcon sx={{ color: '#f44336' }} />;
      case 'warning':
        return <WarningIcon sx={{ color: '#ff9800' }} />;
      case 'info':
      default:
        return <InfoIcon sx={{ color: '#2196f3' }} />;
    }
  };

  const formatNotificationDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
          <IconButton onClick={() => router.back()} sx={{ mr: 2 }} aria-label="Go back">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" fontWeight="bold" sx={{ letterSpacing: 1, color: '#222', fontFamily: 'var(--font-gilroy)' }}>
            Notifications
          </Typography>
        </Box>

        {/* Main Content */}
        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, maxWidth: '800px', margin: '0 auto' }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {!loading && notifications.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary">
                No notifications yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                When you receive notifications, they will appear here.
              </Typography>
            </Box>
          )}

          {!loading && notifications.length > 0 && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => userId && loadNotifications(userId)}
                  sx={{ borderRadius: 2, textTransform: 'none', fontFamily: 'var(--font-nunito)' }}
                >
                  Refresh
                </Button>
              </Box>
              
              <List sx={{ width: '100%' }}>
                {notifications.map((notification, index) => (
                  <Box key={notification.id || index}>
                    {index > 0 && <Divider component="li" />}
                    <ListItem
                      alignItems="flex-start"
                      sx={{
                        bgcolor: notification.read ? 'transparent' : 'rgba(51, 78, 172, 0.04)',
                        borderRadius: 2,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(51, 78, 172, 0.08)' }
                      }}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <Box sx={{ mr: 2, mt: 0.5 }}>
                        {getNotificationIcon(notification.type)}
                      </Box>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography
                              variant="subtitle1"
                              fontWeight={notification.read ? 400 : 600}
                              sx={{ fontFamily: 'var(--font-gilroy)' }}
                            >
                              {notification.title}
                              {!notification.read && (
                                <Chip 
                                  label="New" 
                                  size="small" 
                                  color="primary" 
                                  sx={{ ml: 1, height: 20, fontSize: '0.7rem' }} 
                                />
                              )}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatNotificationDate(notification.timestamp)}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 0.5, fontFamily: 'var(--font-nunito)' }}
                          >
                            {notification.message}
                          </Typography>
                        }
                      />
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        onClick={(e) => notification.id && handleDeleteNotification(notification.id, e)}
                        disabled={notification.id ? isDeleting[notification.id] : false}
                        sx={{ ml: 1 }}
                      >
                        {notification.id && isDeleting[notification.id] ? (
                          <CircularProgress size={20} />
                        ) : (
                          <DeleteIcon fontSize="small" />
                        )}
                      </IconButton>
                    </ListItem>
                  </Box>
                ))}
              </List>
            </>
          )}
        </Paper>
      </Box>
    </Box>
  );
}