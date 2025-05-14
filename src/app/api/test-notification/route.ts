import { NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Missing userId parameter' },
      { status: 400 }
    );
  }
  
  try {
    // Create a test notification
    const notificationsRef = collection(db, 'notifications');
    const docRef = await addDoc(notificationsRef, {
      userId,
      title: 'Test Notification',
      message: 'This is a test notification to verify the notification system is working.',
      type: 'info',
      read: false,
      timestamp: serverTimestamp(),
      extraData: {
        testField: 'This is a test'
      }
    });
    
    return NextResponse.json({
      success: true,
      id: docRef.id,
      message: 'Test notification created successfully'
    });
  } catch (error) {
    console.error('Error creating test notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create test notification' },
      { status: 500 }
    );
  }
}
