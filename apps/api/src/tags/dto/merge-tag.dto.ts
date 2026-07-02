import { IsString, MinLength } from 'class-validator';

export class MergeTagDto {
  /** The tag to keep; the tag named in the URL is folded into this one and then deleted. */
  @IsString()
  @MinLength(1)
  targetId: string;
}
