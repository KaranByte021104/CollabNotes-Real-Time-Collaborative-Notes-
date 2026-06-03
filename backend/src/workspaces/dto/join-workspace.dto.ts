import { IsNotEmpty, IsString } from 'class-validator';

export class JoinWorkspaceDto {
  @IsString()
  @IsNotEmpty({ message: 'Workspace join code is required' })
  code: string;
}
