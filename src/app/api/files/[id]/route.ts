import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { GridFSBucket, ObjectId } from 'mongodb';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const idStr = url.pathname.split('/').pop(); // get the last part of the path

    if (!idStr) {
      return NextResponse.json({ error: 'Missing file ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('attendify');
    const bucket = new GridFSBucket(db);

    const id = new ObjectId(idStr);
    const files = await bucket.find({ _id: id }).toArray();

    if (!files.length) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const stream = bucket.openDownloadStream(id);
    const chunks: Buffer[] = [];

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const file = files[0];

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': file.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000',
        'Content-Disposition': `inline; filename="${file.filename}"`,
      },
    });

  } catch (error) {
    console.error('Error fetching file:', error);
    return NextResponse.json(
      { error: 'Failed to fetch file' },
      { status: 500 }
    );
  }
}
