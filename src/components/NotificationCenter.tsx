"use client";

import { useState, useEffect } from 'react';
import { 
  Box, 
  Badge, 
  IconButton, 
  Popover, 
  List, 
  ListItem, 
  ListItemText, 
  Typography,
  Button,
  Divider,
  CircularProgress,
  Tooltip,
  ListItemSecondaryAction,
  Slide,
  useMediaQuery,
  useTheme
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import DeleteIcon from '@mui/icons-material/Delete';
import { Notification, getUserNotifications, markAllNotificationsAsRead, markNotificationAsRead, deleteNotification } from '../lib/notificationService';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface NotificationCenterProps {
  userId: string;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ userId }) => {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [swipingNotificationId, setSwipingNotificationId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});
  const [swipePosition, setSwipePosition] = useState<Record<string, number>>({});
  const swipeThreshold = 80; // Pixels needed to trigger delete action

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!userId) return;
      
      console.log('Fetching notifications for userId:', userId);
      setLoading(true);
      try {
        const result = await getUserNotifications(userId);
        console.log('Notification fetch result:', result);
        if (result.success && result.notifications) {
          console.log('Notifications data:', result.notifications);
          setNotifications(result.notifications);
          setUnreadCount(result.notifications.filter(n => !n.read).length);
        } else {
          console.log('No notifications found or error in fetch');
        }
      } catch (err) {
        const error = err as Error;
        console.error('Error fetching notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();

    // Set up periodic polling for new notifications (every 30 seconds)
    const intervalId = setInterval(fetchNotifications, 30000);
    
    return () => clearInterval(intervalId);
  }, [userId]);

  // Function to check for notifications directly from Firestore
  const checkFirestoreDirectly = async () => {
    if (!userId) return;
    
    console.log('Checking Firestore directly for userId:', userId);
    try {
      // Try without the orderBy to see if that's causing issues
      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef, 
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      console.log(`Direct Firestore check: Found ${querySnapshot.size} notifications`);
      
      querySnapshot.forEach((doc) => {
        console.log('Direct notification doc:', { id: doc.id, ...doc.data() });
      });
      
      if (querySnapshot.size === 0) {
        console.log('No notifications found directly in Firestore. This suggests you need to create a notification first.');
      }
    } catch (err: any) {
      const error = err as Error;
      console.error('Error in direct Firestore check:', error);
      
      // If there's an error related to indexes, it might contain "FAILED_PRECONDITION"
      if (error.toString().includes('FAILED_PRECONDITION') || error.toString().includes('index')) {
        console.error('====== INDEX ERROR DETECTED ======');
        console.error('You need to create a composite index for this query.');
        console.error('Go to Firebase Console -> Firestore -> Indexes -> Add Index');
        console.error('Collection: notifications');
        console.error('Fields: userId (Ascending), timestamp (Descending)');
      }
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead(userId);
      setNotifications(notifications.map(notification => ({ ...notification, read: true })));
      setUnreadCount(0);
    } catch (err) {
      const error = err as Error;
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications(notifications.map(notification => 
        notification.id === notificationId ? { ...notification, read: true } : notification
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      const error = err as Error;
      console.error('Error marking notification as read:', error);
    }
  };

  const handleDeleteNotification = async (notificationId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation(); // Prevent notification click when deleting
    }
    
    try {
      setIsDeleting(prev => ({ ...prev, [notificationId]: true }));
      await deleteNotification(notificationId);
      
      // Filter out the deleted notification
      setNotifications(current => current.filter(n => n.id !== notificationId));
      
      // Update unread count if needed
      const deletedNotification = notifications.find(n => n.id === notificationId);
      if (deletedNotification && !deletedNotification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      const error = err as Error;
      console.error('Error deleting notification:', error);
    } finally {
      setIsDeleting(prev => ({ ...prev, [notificationId]: false }));
    }
  };

  const handleSwipeStart = (notificationId: string, event: React.TouchEvent) => {
    if (isMobile) {
      setSwipingNotificationId(notificationId);
      const startX = event.touches[0].clientX;
      setSwipePosition(prev => ({ ...prev, [notificationId]: 0 }));
      
      // Add touch move event handler
      const handleTouchMove = (e: TouchEvent) => {
        const currentX = e.touches[0].clientX;
        const diff = startX - currentX;
        // Only allow swiping left (positive diff)
        const swipeDistance = Math.max(0, Math.min(diff, 150)); 
        setSwipePosition(prev => ({ ...prev, [notificationId]: swipeDistance }));
      };
      
      // Add touch end event handler
      const handleTouchEnd = () => {
        const distance = swipePosition[notificationId] || 0;
        if (distance > swipeThreshold) {
          handleDeleteNotification(notificationId);
        } else {
          setSwipePosition(prev => ({ ...prev, [notificationId]: 0 }));
        }
        setSwipingNotificationId(null);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
      
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);
    }
  };

  const handleSwipeEnd = () => {
    if (swipingNotificationId) {
      const distance = swipePosition[swipingNotificationId] || 0;
      if (distance > swipeThreshold) {
        handleDeleteNotification(swipingNotificationId);
      } else {
        setSwipePosition(prev => ({ ...prev, [swipingNotificationId]: 0 }));
      }
      setSwipingNotificationId(null);
    }
  };  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.read && notification.id) {
      handleMarkAsRead(notification.id);
    }
    
    // Navigate based on notification type
    if (notification.extraData?.classCode) {
      if (notification.relatedDoc?.type === 'attendance') {
        // For attendance notifications, navigate to class page
        router.push(`/dashboard/student/class/${notification.extraData.classCode}`);
      } else if (notification.relatedDoc?.type === 'excuse') {
        // For excuse notifications, also navigate to class page
        // We could potentially add a query param to highlight the excuse section if needed
        router.push(`/dashboard/student/class/${notification.extraData.classCode}`);
      }
    }
    
    handleClose(); // Close the popover
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
        return <InfoIcon sx={{ color: '#2196f3' }} />;
      default:
        return <InfoIcon sx={{ color: '#2196f3' }} />;
    }
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) {
      return '';
    }
    
    let date;
    try {
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        // Firebase Timestamp object
        date = timestamp.toDate();
      } else if (timestamp instanceof Date) {
        // Regular Date object
        date = timestamp;
      } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
        // String or number timestamp
        date = new Date(timestamp);
      } else {
        console.error('Unknown timestamp format:', timestamp);
        return 'Invalid date';
      }
      
      // If today, show time
      const now = new Date();
      const isToday = date.getDate() === now.getDate() && 
                      date.getMonth() === now.getMonth() && 
                      date.getFullYear() === now.getFullYear();
      
      if (isToday) {
        return date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      // If this year, show month and day
      const isThisYear = date.getFullYear() === now.getFullYear();
      if (isThisYear) {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
      }
      
      // Otherwise, show full date
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (err) {
      const error = err as Error;
      console.error('Error formatting timestamp:', error, timestamp);
      return 'Date error';
    }
  };
  // Function to format notification timestamp in a user-friendly way
  const formatNotificationTime = (timestamp: any) => {
    if (!timestamp) return '';
    
    let date;
    if (timestamp.toDate) {
      // Firebase Timestamp
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      return '';
    }
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    // If less than 1 minute
    if (diffMins < 1) {
      return 'Just now';
    }
    // If less than 1 hour
    else if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    }
    // If less than 24 hours
    else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    }
    // If less than 7 days
    else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }
    // If earlier this year
    else if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    }
    // Otherwise show the full date
    else {
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const open = Boolean(anchorEl);
  const id = open ? 'notification-popover' : undefined;

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          aria-label={`${unreadCount} unread notifications`}
          color="inherit"
          onClick={handleClick}
          sx={{ 
            color: '#334eac', 
            position: 'relative',
            '&:hover': { backgroundColor: 'rgba(51, 78, 172, 0.08)' }
          }}
        >
          <Badge 
            badgeContent={unreadCount} 
            color="error"
            max={99}
            sx={{ 
              '& .MuiBadge-badge': { 
                bgcolor: '#ea4335',
                fontWeight: 'bold',
                fontSize: '0.7rem',
                minWidth: '18px',
                height: '18px',
              } 
            }}
          >
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>
        <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        BackdropProps={{
          sx: { 
            backgroundColor: 'transparent', // Transparent backdrop
            cursor: 'pointer', // Show clickable cursor
          },
          invisible: false, // Make backdrop visible but transparent
        }}
        sx={{          mt: 1,
          zIndex: 1300, // Higher z-index to ensure it's above other elements
          '& .MuiPopover-paper': {
            width: { xs: '340px', sm: '400px' },
            maxHeight: { xs: '400px', sm: '500px' },
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          },
          '& .MuiBackdrop-root': {
            backgroundColor: 'rgba(0, 0, 0, 0.3)', // Semi-transparent overlay to block interaction
          }
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600, fontFamily: 'var(--font-gilroy)' }}>
            Notifications
          </Typography>
          <Button 
            size="small" 
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0}
            sx={{ 
              fontSize: '0.75rem',
              textTransform: 'none',
              color: unreadCount > 0 ? '#334eac' : '#9e9e9e',
              '&:hover': {
                backgroundColor: unreadCount > 0 ? 'rgba(51, 78, 172, 0.08)' : undefined
              }
            }}
          >
            Mark all as read
          </Button>
        </Box>
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress size={28} sx={{ color: '#334eac' }} />
          </Box>
        ) : notifications.length > 0 ? (
          <List sx={{ p: 0, maxHeight: '400px', overflow: 'auto' }}>
            {notifications.map((notification, index) => (
              <Slide 
                direction="right" 
                in={!isDeleting[notification.id || '']} 
                key={notification.id || index}
                mountOnEnter
                unmountOnExit
              >
                <Box sx={{ 
                  position: 'relative', 
                  overflow: 'hidden',
                  '&::after': isMobile ? {
                    content: '"DELETE"',
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    height: '100%',
                    width: '80px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#f44336',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '0.875rem',
                    transform: swipePosition[notification.id || ''] ? 'translateX(0)' : 'translateX(100%)',
                    opacity: swipePosition[notification.id || ''] ? 
                      Math.min(1, (swipePosition[notification.id || ''] || 0) / swipeThreshold) : 0,
                    transition: swipingNotificationId === notification.id ? 'none' : 'all 0.3s ease-out'
                  } : {}
                }}>
                  <ListItem 
                    component="div"
                    alignItems="flex-start"
                    onClick={() => handleNotificationClick(notification)}
                    sx={{
                      px: 2, 
                      pt: 1.5,
                      pb: 1.5,
                      backgroundColor: notification.read ? 'transparent' : 'rgba(51, 78, 172, 0.04)',
                      cursor: 'pointer',
                      position: 'relative',
                      transform: swipePosition[notification.id || ''] ? 
                        `translateX(-${swipePosition[notification.id || '']}px)` : 'translateX(0)',
                      transition: swipingNotificationId === notification.id ? 
                        'none' : 'transform 0.3s ease-out, background-color 0.2s',
                      '&:hover': {
                        backgroundColor: notification.read ? 'rgba(0, 0, 0, 0.03)' : 'rgba(51, 78, 172, 0.08)',
                      }
                    }}
                    onTouchStart={(e) => notification.id && handleSwipeStart(notification.id, e)}
                    onTouchEnd={handleSwipeEnd}
                  >
                    <Box sx={{ mr: 1.5, mt: 0.5 }}>
                      {getNotificationIcon(notification.type)}
                    </Box>
                    <ListItemText
                      primary={
                        <Typography variant="subtitle2" component="span" sx={{ 
                          fontWeight: notification.read ? 500 : 600, 
                          mb: 0.5, 
                          fontFamily: 'var(--font-gilroy)',
                          display: 'block'
                        }}>
                          {notification.title}
                        </Typography>
                      }
                      secondary={
                        <>
                          <Typography variant="body2" component="span" sx={{ 
                            color: 'text.secondary',
                            fontWeight: notification.read ? 400 : 500,
                            fontSize: '0.85rem',
                            display: 'block',
                            mb: 0.5,
                            fontFamily: 'var(--font-nunito)',
                            paddingRight: !isMobile ? '42px' : 0 // Add padding-right on desktop to avoid overlap with delete icon
                          }}>
                            {notification.message}
                          </Typography>                          <Typography variant="caption" component="span" sx={{ 
                            color: 'text.disabled',
                            fontSize: '0.75rem',
                            fontFamily: 'var(--font-nunito)',
                            display: 'block',
                            paddingRight: !isMobile ? '42px' : 0 // Also add padding to timestamp on desktop
                          }}>
                            {formatNotificationTime(notification.timestamp)}
                          </Typography>
                        </>
                      }
                    />
                    {!isMobile && notification.id && (
                      <ListItemSecondaryAction>
                        <IconButton 
                          edge="end" 
                          aria-label="delete" 
                          size="small"
                          onClick={(e) => notification.id && handleDeleteNotification(notification.id, e)}
                          sx={{ 
                            color: 'text.secondary',
                            opacity: 0.6,
                            '&:hover': {
                              opacity: 1,
                              color: '#f44336',
                              backgroundColor: 'rgba(244, 67, 54, 0.08)'
                            }
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </ListItemSecondaryAction>
                    )}
                  </ListItem>
                  {index < notifications.length - 1 && <Divider />}
                </Box>
              </Slide>
            ))}
          </List>
        ) : (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'var(--font-nunito)', mb: 2 }}>
              No notifications yet
            </Typography>
          </Box>
        )}
      </Popover>
    </>
  );
};

export default NotificationCenter;
