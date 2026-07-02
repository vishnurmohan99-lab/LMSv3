import { IsString, MinLength } from 'class-validator';

export class UpdateTagDto {
  @IsString()
  @MinLength(1)
  name: string;
}
