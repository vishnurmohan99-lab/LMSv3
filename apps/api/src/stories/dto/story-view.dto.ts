import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class StoryViewDto {
  /** Furthest point reached in this sitting; the server keeps the maximum. */
  @IsOptional()
  @IsInt()
  @Min(0)
  watchedSeconds?: number;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  /** True only on the first ping of an open, so viewCount tracks opens, not pings. */
  @IsOptional()
  @IsBoolean()
  opened?: boolean;
}
