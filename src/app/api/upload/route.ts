import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { GridFSBucket } from 'mongodb';
import { Readable } from 'stream';

export async function POST(req: NextRequest) {
  console.log('[API] /api/upload called');
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File;
    const classCode = formData.get('classCode') as string;
    const type = formData.get('type') as string;

    console.log('[API] Form data:', { hasFile: !!file, classCode, type });

    if (!file || !classCode || !type) {
      console.error('[API] Missing required fields', { hasFile: !!file, classCode, type });
      return new NextResponse(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const client = await clientPromise;
    const db = client.db('attendify');
    const bucket = new GridFSBucket(db);

    const buffer = Buffer.from(await file.arrayBuffer());
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);

    const fileExtension = file.name.split('.').pop() || '';
    const fileName = `${type}_${classCode}_${Date.now()}.${fileExtension}`;

    const uploadStream = bucket.openUploadStream(fileName, {
      contentType: file.type,
      metadata: {
        classCode,
        type,
        originalName: file.name,
        uploadDate: new Date()
      }
    });

    await new Promise<void>((resolve, reject) => {
      readable
        .pipe(uploadStream)
        .on('error', (err) => {
          console.error('[API] Upload stream error:', err);
          reject(err);
        })
        .on('finish', () => {
          console.log('[API] File uploaded to MongoDB', uploadStream.id);
          resolve();
        });
    });

    return new NextResponse(
      JSON.stringify({
        success: true,
        mongoUrl: `/api/files/${uploadStream.id}`
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[API] Upload error:', error);
    return new NextResponse(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload file to MongoDB' 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

export const config = {
  api: {
    bodyParser: false
  }
};