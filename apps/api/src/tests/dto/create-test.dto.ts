import { IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { TestType } from '../../../generated/prisma/client';

export class CreateTestDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsEnum(TestType)
  type?: TestType;

  @IsOptional()
  @IsString()
  chapterId?: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  segmentId?: string;

  @IsOptional()
  @IsString()
  subsegmentId?: string;
}
