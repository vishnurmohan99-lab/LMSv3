import { IsString, MinLength } from 'class-validator';

export class SetCheatSheetPosterDto {
  @IsString()
  @MinLength(1)
  imageKey: string;
}
