import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs,
  updateDoc,
  doc,
  orderBy,
  serverTimestamp,
  Timestamp,
  deleteDoc
} from 'firebase/firestore';

export interface Notification {
  id?: string;
  userId: string;
  message: string;
  title: string;
  type: 'success' | 'error' | 'warning' | 'info';
  read: boolean;
  timestamp: Timestamp;
  relatedDoc?: {
    type: string; // 'attendance', 'excuse', etc.
    id: string;
  };
  extraData?: {
    classCode?: string;
    className?: string;
    subject?: string;
    date?: string;
  };
}

/**
 * Creates a new notification for a user
 */
export const createNotification = async (notification: Omit<Notification, 'id' | 'read' | 'timestamp'>) => {
  try {
    console.log("Creating notification with data:", JSON.stringify(notification, null, 2));
    
    const notificationsRef = collection(db, 'notifications');
    const docRef = await addDoc(notificationsRef, {
      ...notification,
      read: false,
      timestamp: serverTimestamp(),
    });
    
    console.log("Notification created successfully with ID:", docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error creating notification:', error);
    return { success: false, error };
  }
};

/**
 * Get all notifications for a user
 */
export const getUserNotifications = async (userId: string) => {
  try {
    console.log('getUserNotifications called with userId:', userId);
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef, 
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );
    
    console.log('Executing Firestore query for notifications...');
    const querySnapshot = await getDocs(q);
    console.log(`Found ${querySnapshot.size} notification documents`);
    
    const notifications: Notification[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log('Notification document data:', { id: doc.id, ...data });
      notifications.push({ id: doc.id, ...data } as Notification);
    });
    
    return { success: true, notifications };
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return { success: false, error, notifications: [] };
  }
};

/**
 * Mark a notification as read
 */
export const markNotificationAsRead = async (notificationId: string) => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, { read: true });
    return { success: true };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return { success: false, error };
  }
};

/**
 * Mark all user's notifications as read
 */
export const markAllNotificationsAsRead = async (userId: string) => {
  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(notificationsRef, where('userId', '==', userId), where('read', '==', false));
    const querySnapshot = await getDocs(q);
    
    const updatePromises = querySnapshot.docs.map(doc => 
      updateDoc(doc.ref, { read: true })
    );
    
    await Promise.all(updatePromises);
    return { success: true };
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return { success: false, error };
  }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (notificationId: string) => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await deleteDoc(notificationRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting notification:', error);
    return { success: false, error };
  }
};

/**
 * Create an attendance submission notification
 */
export const createAttendanceSubmissionNotification = async (
  userId: string, 
  status: 'present' | 'late' | 'excused' | 'absent',
  classCode: string,
  className: string,
  subject: string | null,
  attendanceId: string,
  date: Date
) => {
  let title = '';
  let message = '';
  let type: 'success' | 'error' | 'warning' | 'info' = 'success';
  
  const dateStr = date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const subjectText = subject ? ` for ${subject}` : '';
  
  switch (status) {
    case 'present':
      title = 'Attendance Recorded';
      message = `Your attendance${subjectText} in ${className} has been recorded for ${dateStr}.`;
      type = 'success';
      break;
    case 'late':
      title = 'Late Attendance Recorded';
      message = `Your attendance${subjectText} in ${className} has been marked as LATE for ${dateStr}.`;
      type = 'warning';
      break;
    case 'excused':
      title = 'Excuse Submitted';
      message = `Your excuse${subjectText} for ${className} on ${dateStr} has been submitted. Waiting for instructor approval.`;
      type = 'info';
      break;
    case 'absent':
      title = 'Marked as Absent';
      message = `You have been marked as ABSENT${subjectText} in ${className} for ${dateStr}.`;
      type = 'error';
      break;
  }
    // Prepare extraData without any undefined values
  const extraData: any = {
    classCode,
    className,
    date: dateStr
  };
  
  // Only add subject if it exists
  if (subject) {
    extraData.subject = subject;
  }

  return createNotification({
    userId,
    title,
    message,
    type,
    relatedDoc: {
      type: 'attendance',
      id: attendanceId
    },
    extraData
  });
};

/**
 * Create an excuse status notification
 */
export const createExcuseStatusNotification = async (
  userId: string,
  approved: boolean,
  classCode: string,
  className: string,
  subject: string | null,
  excuseId: string,
  date: Date
) => {
  console.log("Creating excuse status notification with details:", {
    userId,
    approved,
    classCode,
    className,
    subject,
    excuseId,
    dateObj: date
  });
  // Ensure we use the original submission date from the excuse document
  const dateStr = date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric'
  });
  
  const subjectText = subject ? ` for ${subject}` : '';
  
  const title = approved ? 'Excuse Approved' : 'Excuse Declined';
  const message = approved
    ? `Your excuse${subjectText} for ${className} on ${dateStr} has been approved.`
    : `Your excuse${subjectText} for ${className} on ${dateStr} has been declined. Please contact your instructor.`;
  
  console.log(`Created notification with title: "${title}" and message: "${message}"`);
  
  const type = approved ? 'success' : 'error';
    // Prepare extraData without any undefined values
  const extraData: any = {
    classCode,
    className,
    date: dateStr
  };
  
  // Only add subject if it exists
  if (subject) {
    extraData.subject = subject;
  }

  return createNotification({
    userId,
    title,
    message,
    type,
    relatedDoc: {
      type: 'excuse',
      id: excuseId
    },
    extraData
  });
};
