import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { MessengerService } from './messenger.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ScheduleMessageDto } from './dto/schedule-message.dto';

@UseGuards(JwtAccessGuard)
@Controller()
export class MessengerController {
  constructor(private readonly messenger: MessengerService) {}

  @Get('messenger/contacts')
  listContacts(@CurrentUser() user: JwtPayload) {
    return this.messenger.listContacts(user);
  }

  @Post('conversations')
  createConversation(@Body() dto: CreateConversationDto, @CurrentUser() user: JwtPayload) {
    return this.messenger.createConversation(user, dto);
  }

  @Get('conversations')
  listConversations(@CurrentUser() user: JwtPayload) {
    return this.messenger.listConversations(user);
  }

  @Get('conversations/:id/messages')
  listMessages(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.messenger.listMessages(user, id);
  }

  @Post('conversations/:id/messages')
  sendMessage(@Param('id') id: string, @Body() dto: SendMessageDto, @CurrentUser() user: JwtPayload) {
    return this.messenger.sendMessage(user, id, dto);
  }

  @Post('conversations/:id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.messenger.markRead(user, id);
  }

  @Get('messages/unread-count')
  getUnreadCount(@CurrentUser() user: JwtPayload) {
    return this.messenger.getUnreadCount(user);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Post('scheduled-messages')
  scheduleMessage(@Body() dto: ScheduleMessageDto, @CurrentUser() user: JwtPayload) {
    return this.messenger.scheduleMessage(user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Get('scheduled-messages')
  listScheduled(@CurrentUser() user: JwtPayload) {
    return this.messenger.listScheduled(user);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Delete('scheduled-messages/:id')
  cancelScheduled(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.messenger.cancelScheduled(id, user);
  }
}
