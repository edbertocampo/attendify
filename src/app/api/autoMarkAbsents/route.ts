import { NextResponse } from 'next/server';
import admin, { getFirestoreAdmin } from '@/lib/firebase-admin';

// Get a Firestore instance using our custom initialization function
const db = getFirestoreAdmin();

// Convert any time format to 24-hour format
function normalizeTimeFormat(timeStr: string): string | null {
  if (!timeStr) return null;
  
  // If already in 24-hour format (like "14:30"), return as is
  if (/^[0-2]?[0-9]:[0-5][0-9]$/.test(timeStr)) {
    return timeStr;
  }
  
  try {
    // Handle formats like "2:30 pm"
    timeStr = timeStr.toLowerCase();
    let [time, meridiem] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    
    if (meridiem === 'pm' && hours < 12) {
      hours += 12;
    } else if (meridiem === 'am' && hours === 12) {
      hours = 0;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  } catch (error) {
    console.error(`[API autoMarkAbsents] Error normalizing time format: ${timeStr}`, error);
    return null;
  }
}

// Disabled: Auto mark absent is currently turned off for this project
export async function GET() {
  return NextResponse.json({ message: "Auto mark absent is currently disabled." }, { status: 200 });
}
