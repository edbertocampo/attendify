// The purpose of this middleware is to check for notifications that should be displayed
// when a user navigates between pages, such as attendance updates, system messages, etc.
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Get the pathname from the URL to identify specific pages for notifications
  const pathname = request.nextUrl.pathname;
  
  // Get the user session cookie to check if the user is authenticated
  const sessionCookie = request.cookies.get('session');
  
  // Only continue if we have a session (user is logged in)
  if (!sessionCookie?.value) {
    return response;
  }

  // For attendance pages - we could check for pending attendance notifications
  if (pathname.includes('/dashboard/student/class/')) {
    // We could use cookies to store temporary notification flags
    // For now, we'll just continue with the request
  }

  // For notification polling - you can set headers to control client-side polling frequency
  if (pathname.includes('/dashboard/student')) {
    response.headers.set('X-Notification-Check-Interval', '30000'); // 30 seconds
  }

  return response;
}

// Configure the middleware to run on specific paths
export const config = {
  // Matcher for pages where we want to run notification checks
  matcher: [
    '/dashboard/student/:path*',
    '/dashboard/instructor/:path*'
  ],
};
