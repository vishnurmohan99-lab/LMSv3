import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { SendMessageDto } from './dto/send-message.dto';

@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('STUDENT')
@Controller()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('lessons/:lessonId/chat')
  history(@Param('lessonId') lessonId: string, @CurrentUser() user: JwtPayload) {
    return this.chatService.getHistory(lessonId, user);
  }

  @Post('lessons/:lessonId/chat')
  send(@Param('lessonId') lessonId: string, @Body() dto: SendMessageDto, @CurrentUser() user: JwtPayload) {
    return this.chatService.sendMessage(lessonId, user, dto.message);
  }

  @Delete('lessons/:lessonId/chat')
  reset(@Param('lessonId') lessonId: string, @CurrentUser() user: JwtPayload) {
    return this.chatService.resetHistory(lessonId, user);
  }
}
