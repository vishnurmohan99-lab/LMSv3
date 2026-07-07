import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateCourseReviewDto } from './dto/create-course-review.dto';

@UseGuards(JwtAccessGuard)
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query('segmentId') segmentId?: string,
    @Query('subsegmentId') subsegmentId?: string,
  ) {
    return this.coursesService.listCourses(user, { segmentId, subsegmentId });
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.coursesService.getCourseTree(id, user);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Post()
  create(@Body() dto: CreateCourseDto, @CurrentUser() user: JwtPayload) {
    return this.coursesService.createCourse(user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCourseDto, @CurrentUser() user: JwtPayload) {
    return this.coursesService.updateCourse(id, user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.coursesService.deleteCourse(id, user);
  }

  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  @Post(':id/enroll')
  enroll(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.coursesService.enroll(id, user);
  }

  // ---- Course reviews / ratings ----
  @Get(':id/reviews')
  listReviews(@Param('id') id: string) {
    return this.coursesService.listReviews(id);
  }

  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  @Get(':id/reviews/me')
  myReview(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.coursesService.myReview(id, user);
  }

  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  @Post(':id/reviews')
  upsertReview(@Param('id') id: string, @Body() dto: CreateCourseReviewDto, @CurrentUser() user: JwtPayload) {
    return this.coursesService.upsertReview(id, user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Get(':id/private-access')
  listPrivateAccess(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.coursesService.listPrivateAccess(id, user);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Post(':id/private-access/:studentId')
  grantPrivateAccess(@Param('id') id: string, @Param('studentId') studentId: string, @CurrentUser() user: JwtPayload) {
    return this.coursesService.grantPrivateAccess(id, user, studentId);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Delete(':id/private-access/:studentId')
  revokePrivateAccess(@Param('id') id: string, @Param('studentId') studentId: string, @CurrentUser() user: JwtPayload) {
    return this.coursesService.revokePrivateAccess(id, user, studentId);
  }
}
