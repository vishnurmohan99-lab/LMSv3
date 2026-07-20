import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TagsModule } from './tags/tags.module';
import { SearchModule } from './search/search.module';
import { NotesModule } from './notes/notes.module';
import { StudyPlanModule } from './study-plan/study-plan.module';
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
import { ReportsModule } from './reports/reports.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { CalendarModule } from './calendar/calendar.module';
import { TodosModule } from './todos/todos.module';
import { AnswerCorrectionModule } from './answer-correction/answer-correction.module';
import { ReflectionsModule } from './reflections/reflections.module';
import { AiSettingsModule } from './ai-settings/ai-settings.module';

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
    ReportsModule,
    SubscriptionsModule,
    CalendarModule,
    TodosModule,
    AnswerCorrectionModule,
    ReflectionsModule,
    AiSettingsModule,
    TagsModule,
    SearchModule,
    NotesModule,
    StudyPlanModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
