import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { AiModule } from '../ai/ai.module';
import { CoursesModule } from '../courses/courses.module';

@Module({
  imports: [AiModule, CoursesModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
