import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty({ message: 'Workspace name is required' })
  @MinLength(1, { message: 'Workspace name must be at least 1 character' })
  @MaxLength(60, { message: 'Workspace name cannot exceed 60 characters' })
  name: string;
}
