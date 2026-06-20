import { IsIn, IsString, MinLength } from 'class-validator';

const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

export class PresignUploadDto {
  @IsString()
  @MinLength(1)
  fileName: string;

  @IsIn(ALLOWED_CONTENT_TYPES)
  contentType: string;
}
