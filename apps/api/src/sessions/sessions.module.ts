import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { BatchesModule } from '../batches/batches.module';

@Module({
  imports: [BatchesModule],
  controllers: [SessionsController],
  providers: [SessionsService],
})
export class SessionsModule {}
