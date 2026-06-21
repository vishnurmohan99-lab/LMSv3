import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { UploadsModule } from './uploads/uploads.module';
import { CoursesModule } from './courses/courses.module';
import { AdminModule } from './admin/admin.module';
import { SegmentsModule } from './segments/segments.module';
import { QuestionBanksModule } from './question-banks/question-banks.module';
import { TestsModule } from './tests/tests.module';
import { ChatModule } from './chat/chat.module';
import { BatchesModule } from './batches/batches.module';
import { SessionsModule } from './sessions/sessions.module';
import { BatchStatusTypesModule } from './batch-status-types/batch-status-types.module';
import { BulkOperationsModule } from './bulk-operations/bulk-operations.module';
import { MessengerModule } from './messenger/messenger.module';
import { TestAttemptsModule } from './test-attempts/test-attempts.module';
import { WorkoutModule } from './workout/workout.module';
import { MentorModule } from './mentor/mentor.module';
import { FeedbackModule } from './feedback/feedback.module';
import { ForumModule } from './forum/forum.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    UsersModule,
    AuthModule,
    UploadsModule,
    CoursesModule,
    AdminModule,
    SegmentsModule,
    QuestionBanksModule,
    TestsModule,
    ChatModule,
    BatchesModule,
    SessionsModule,
    BatchStatusTypesModule,
    BulkOperationsModule,
    MessengerModule,
    TestAttemptsModule,
    WorkoutModule,
    MentorModule,
    FeedbackModule,
    ForumModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
