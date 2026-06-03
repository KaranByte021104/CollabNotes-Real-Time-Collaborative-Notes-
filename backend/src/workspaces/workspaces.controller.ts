import { Controller, Post, Get, Body, Param, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { JoinWorkspaceDto } from './dto/join-workspace.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async createWorkspace(
    @CurrentUser() user: { userId: string },
    @Body() createWorkspaceDto: CreateWorkspaceDto,
  ) {
    return this.workspacesService.createWorkspace(user.userId, createWorkspaceDto.name);
  }

  @Post('join')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async joinWorkspace(
    @CurrentUser() user: { userId: string },
    @Body() joinWorkspaceDto: JoinWorkspaceDto,
  ) {
    return this.workspacesService.joinWorkspace(user.userId, joinWorkspaceDto.code);
  }

  @Get()
  async getUserWorkspaces(@CurrentUser() user: { userId: string }) {
    return this.workspacesService.getUserWorkspaces(user.userId);
  }

  @Get(':id')
  async getWorkspace(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.workspacesService.getWorkspace(id, user.userId);
  }
}
