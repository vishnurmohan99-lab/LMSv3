import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class BulkEnrollDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  studentIds: string[];
}
