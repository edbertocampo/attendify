import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { db } from '../../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Define the request body interface
interface EmailRequestBody {
  userId: string;
  subject: string;
  message: string;
  notificationType?: 'success' | 'error' | 'warning' | 'info';
}

export async function POST(request: Request) {
  try {
    // Parse request body
    const body: EmailRequestBody = await request.json();
    
    // Validate required fields
    if (!body.userId || !body.subject || !body.message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: userId, subject, or message' },
        { status: 400 }
      );
    }
    
    // Get user email from Firestore
    const userDoc = await getDoc(doc(db, 'users', body.userId));
    
    if (!userDoc.exists()) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }
    
    const userData = userDoc.data();
    const userEmail = userData.email;
    
    if (!userEmail) {
      return NextResponse.json(
        { success: false, error: 'User has no email address' },
        { status: 400 }
      );
    }
    
    // Send email
    const info = await transporter.sendMail({
      from: `"Attendify" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: body.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://attendify-5hii4ldtk-edbertocampos-projects.vercel.app/attendify.svg" alt="Attendify Logo" style="max-width: 150px;">
          </div>
          <div style="color: #333; line-height: 1.6;">
            ${body.message}
          </div>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea; font-size: 12px; color: #666; text-align: center;">
            &copy; ${new Date().getFullYear()} Attendify. All rights reserved.
          </div>
        </div>
      `,
    });
    
    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      message: 'Email notification sent successfully'
    });
    
  } catch (error) {
    console.error('Error sending email notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send email notification' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return API documentation
  return NextResponse.json({
    success: true,
    message: 'Email Notification API',
    usage: {
      method: 'POST',
      contentType: 'application/json',
      body: {
        userId: 'string (required) - The user ID to send the email to',
        subject: 'string (required) - The email subject line',
        message: 'string (required) - The HTML content of the email',
        notificationType: 'string (optional) - Can be success, error, warning, or info'
      }
    }
  });
}