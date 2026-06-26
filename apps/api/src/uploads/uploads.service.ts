import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 60 * 60;

@Injectable()
export class UploadsService {
  private readonly client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  private readonly bucket = process.env.R2_BUCKET_NAME!;

  async presignUpload(fileName: string, contentType: string) {
    const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const key = `lessons/${randomUUID()}-${safeName}`;

    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );

    return { uploadUrl, key };
  }

  /** Private-bucket upload for handwritten answer photos -- student PII, must stay private (not the public question-images bucket path). */
  async presignAnswerSubmissionUpload(fileName: string, contentType: string) {
    const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const key = `answer-submissions/${randomUUID()}-${safeName}`;

    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );

    return { uploadUrl, key };
  }

  async presignPublicImageUpload(fileName: string, contentType: string) {
    const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const key = `question-images/${randomUUID()}-${safeName}`;

    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );

    const publicUrl = `${process.env.R2_PUBLIC_BASE_URL}/${key}`;
    return { uploadUrl, publicUrl };
  }

  async presignDownload(key: string) {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: DOWNLOAD_URL_TTL_SECONDS,
    });
  }

  /** Direct server-side upload (no presigned URL round-trip) for AI-generated images, e.g. Cheat Sheet illustrations. */
  async uploadGeneratedImage(buffer: Buffer, contentType: string): Promise<string> {
    const ext = contentType.split('/')[1] ?? 'png';
    const key = `cheat-sheet-images/${randomUUID()}.${ext}`;
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: contentType }));
    return key;
  }

  async getObjectBuffer(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks: Buffer[] = [];
    for await (const chunk of result.Body as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}
