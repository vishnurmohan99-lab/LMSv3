import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, ValidateNested } from 'class-validator';

class StoryOrderDto {
  @IsString()
  id: string;

  @IsInt()
  order: number;
}

export class ReorderStoriesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StoryOrderDto)
  items: StoryOrderDto[];
}
