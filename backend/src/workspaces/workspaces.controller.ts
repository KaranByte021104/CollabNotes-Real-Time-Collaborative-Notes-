import { Controller, Post, Get, Patch, Delete, Body, Param, Query, Res, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import * as express from 'express';
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
  async getUserWorkspaces(
    @CurrentUser() user: { userId: string },
    @Query('archived') archived?: string,
  ) {
    const isArchived = archived === 'true';
    return this.workspacesService.getUserWorkspaces(user.userId, isArchived);
  }

  @Get(':id/search')
  async searchNotes(
    @Param('id') workspaceId: string,
    @CurrentUser() user: { userId: string },
    @Query('q') query: string,
  ) {
    return this.workspacesService.searchNotes(workspaceId, user.userId, query);
  }

  @Get(':id')
  async getWorkspace(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.workspacesService.getWorkspace(id, user.userId);
  }

  @Get(':id/export')
  async exportWorkspace(
    @Param('id') workspaceId: string,
    @CurrentUser() user: { userId: string },
    @Res() res: express.Response,
  ) {
    return this.workspacesService.exportWorkspace(workspaceId, user.userId, res);
  }

  // --- Sprint 8: Note Endpoints ---

  @Post(':id/notes')
  async createNote(
    @Param('id') workspaceId: string,
    @CurrentUser() user: { userId: string },
    @Body('title') title?: string,
    @Body('content') content?: string,
  ) {
    return this.workspacesService.createNote(workspaceId, user.userId, title, content);
  }

  @Patch(':id/notes/:noteId')
  async renameNote(
    @Param('id') workspaceId: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: { userId: string },
    @Body('title') title: string,
  ) {
    return this.workspacesService.renameNote(noteId, workspaceId, user.userId, title);
  }

  @Patch(':id/notes/:noteId/lock')
  async lockNote(
    @Param('id') workspaceId: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.workspacesService.lockNote(workspaceId, noteId, user.userId);
  }

  @Patch(':id/notes/:noteId/unlock')
  async unlockNote(
    @Param('id') workspaceId: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.workspacesService.unlockNote(workspaceId, noteId, user.userId);
  }

  @Patch(':id/notes/:noteId/pin')
  async pinNote(
    @Param('id') workspaceId: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.workspacesService.pinNote(workspaceId, noteId, user.userId);
  }

  @Patch(':id/notes/:noteId/unpin')
  async unpinNote(
    @Param('id') workspaceId: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.workspacesService.unpinNote(workspaceId, noteId, user.userId);
  }

  @Delete(':id/notes/:noteId')
  async deleteNote(
    @Param('id') workspaceId: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.workspacesService.deleteNote(noteId, workspaceId, user.userId);
  }

  // --- Sprint 8: Workspace Deletion ---

  @Patch(':id/archive')
  async archiveWorkspace(
    @Param('id') workspaceId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.workspacesService.archiveWorkspace(workspaceId, user.userId);
  }

  @Patch(':id/unarchive')
  async unarchiveWorkspace(
    @Param('id') workspaceId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.workspacesService.unarchiveWorkspace(workspaceId, user.userId);
  }

  @Delete(':id')
  async deleteWorkspace(
    @Param('id') workspaceId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.workspacesService.deleteWorkspace(workspaceId, user.userId);
  }

  @Post(':id/leave')
  async leaveWorkspace(
    @Param('id') workspaceId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.workspacesService.leaveWorkspace(workspaceId, user.userId);
  }


  // --- Sprint 9: Tags Endpoints ---

  @Get(':id/tags')
  async getTags(
    @Param('id') workspaceId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.workspacesService.getTags(workspaceId, user.userId);
  }

  @Post(':id/tags')
  async createTag(
    @Param('id') workspaceId: string,
    @CurrentUser() user: { userId: string },
    @Body('name') name: string,
    @Body('color') color: string,
  ) {
    return this.workspacesService.createTag(workspaceId, user.userId, name, color);
  }

  @Delete(':id/tags/:tagId')
  async deleteTag(
    @Param('id') workspaceId: string,
    @Param('tagId') tagId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.workspacesService.deleteTag(workspaceId, tagId, user.userId);
  }

  @Post(':id/notes/:noteId/tags/:tagId')
  async applyTagToNote(
    @Param('id') workspaceId: string,
    @Param('noteId') noteId: string,
    @Param('tagId') tagId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.workspacesService.applyTagToNote(workspaceId, noteId, tagId, user.userId);
  }

  @Delete(':id/notes/:noteId/tags/:tagId')
  async removeTagFromNote(
    @Param('id') workspaceId: string,
    @Param('noteId') noteId: string,
    @Param('tagId') tagId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.workspacesService.removeTagFromNote(workspaceId, noteId, tagId, user.userId);
  }

  // --- Sprint 8: Member Endpoints ---

  @Get(':id/members')
  async getWorkspaceMembers(
    @Param('id') workspaceId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.workspacesService.getWorkspaceMembers(workspaceId, user.userId);
  }

  @Delete(':id/members/:targetUserId')
  async removeMember(
    @Param('id') workspaceId: string,
    @Param('targetUserId') targetUserId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.workspacesService.removeMember(workspaceId, targetUserId, user.userId);
  }
}
