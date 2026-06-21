import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ConversationType } from '../../../generated/prisma/client';

export class CreateConversationDto {
  @IsEnum(ConversationType)
  type: ConversationType;

  // DIRECT: the other participant's user id
  @IsOptional()
  @IsString()
  userId?: string;

  // COURSE_BROADCAST
  @IsOptional()
  @IsString()
  courseId?: string;

  // BATCH_BROADCAST
  @IsOptional()
  @IsString()
  batchId?: string;

  // GROUP: additional participant ids
  @IsOptional()
  @IsString({ each: true })
  participantIds?: string[];
}
