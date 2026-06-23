import { ArrayUnique, IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ForumScopeType, ForumAccessMode } from '../../../generated/prisma/client';

export class CreateForumCategoryDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsEnum(ForumScopeType)
  scopeType: ForumScopeType;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsEnum(ForumAccessMode)
  audienceFacultyMode?: ForumAccessMode;

  @IsOptional()
  @IsEnum(ForumAccessMode)
  audienceStudentMode?: ForumAccessMode;

  @IsOptional()
  @IsEnum(ForumAccessMode)
  postFacultyMode?: ForumAccessMode;

  @IsOptional()
  @IsEnum(ForumAccessMode)
  postStudentMode?: ForumAccessMode;

  @IsOptional()
  @IsEnum(ForumAccessMode)
  commentFacultyMode?: ForumAccessMode;

  @IsOptional()
  @IsEnum(ForumAccessMode)
  commentStudentMode?: ForumAccessMode;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  audienceUserIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  postUserIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  commentUserIds?: string[];
}
