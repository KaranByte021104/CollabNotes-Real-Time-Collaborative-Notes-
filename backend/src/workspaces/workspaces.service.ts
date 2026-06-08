import { Injectable, NotFoundException, ForbiddenException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workspace } from '../entities/workspace.entity';
import { Note } from '../entities/note.entity';
import { User } from '../entities/user.entity';
import { WorkspaceParticipant } from '../entities/workspace-participant.entity';
import { ActivityLog, ActivityEventType } from '../entities/activity-log.entity';
import { generateCode } from '../common/utils/generate-code';
import { CollaborationGateway } from '../collaboration/collaboration.gateway';
import { YdocStoreService } from '../collaboration/ydoc-store.service';
import { tiptapJsonToPlainText, getSnippet } from '../common/utils/tiptap';
import { Tag } from '../entities/tag.entity';
import { NotificationsService } from '../notifications/notifications.service';
import * as archiver from 'archiver';
import * as express from 'express';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(Note)
    private readonly noteRepository: Repository<Note>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(WorkspaceParticipant)
    private readonly participantRepository: Repository<WorkspaceParticipant>,
    @InjectRepository(ActivityLog)
    private readonly logRepository: Repository<ActivityLog>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    private readonly collaborationGateway: CollaborationGateway,
    private readonly ydocStore: YdocStoreService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createWorkspace(userId: string, name: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate unique code with retry logic
    let code = '';
    let attempts = 0;
    const maxAttempts = 5;
    let codeExists = true;

    while (codeExists && attempts < maxAttempts) {
      code = generateCode();
      const existing = await this.workspaceRepository.findOne({ where: { code } });
      if (!existing) {
        codeExists = false;
      }
      attempts++;
    }

    if (codeExists) {
      throw new InternalServerErrorException('Failed to generate a unique workspace code. Please try again.');
    }

    // Create and save workspace
    const workspace = new Workspace();
    workspace.name = name;
    workspace.code = code;
    workspace.createdBy = user;
    const savedWorkspace = await this.workspaceRepository.save(workspace);

    // Create and save default note
    const note = new Note();
    note.title = 'Welcome Note';
    note.order = 0;
    note.content = '{"type":"doc","content":[{"type":"paragraph"}]}';
    note.ydocState = null;
    note.workspace = savedWorkspace;
    const savedNote = await this.noteRepository.save(note);
    
    savedWorkspace.notes = [savedNote];

    // Add user as participant
    const participant = new WorkspaceParticipant();
    participant.workspace = savedWorkspace;
    participant.user = user;
    participant.workspaceId = savedWorkspace.id;
    participant.userId = user.id;
    await this.participantRepository.save(participant);

    // Add activity log
    const activityLog = new ActivityLog();
    activityLog.eventType = ActivityEventType.USER_JOINED;
    activityLog.workspace = savedWorkspace;
    activityLog.user = user;
    activityLog.metadata = { name: user.name };
    await this.logRepository.save(activityLog);

    // Break circular references before returning to prevent serialization issues
    if (savedWorkspace.notes) {
      savedWorkspace.notes.forEach((n: any) => {
        n.workspace = undefined;
      });
    }

    return savedWorkspace;
  }

  async joinWorkspace(userId: string, code: string) {
    const normalizedCode = code.trim().toLowerCase();
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const workspace = await this.workspaceRepository.findOne({
      where: { code: normalizedCode },
      relations: { notes: true },
    });

    if (!workspace) {
      throw new NotFoundException('No workspace found with that code. Please check and try again.');
    }

    // Sort notes
    if (workspace.notes) {
      workspace.notes.sort((a, b) => a.order - b.order);
      workspace.notes.forEach((n: any) => {
        n.workspace = undefined;
      });
    }

    // Check if already a participant
    const existingParticipant = await this.participantRepository.findOne({
      where: { workspaceId: workspace.id, userId: user.id },
    });

    if (!existingParticipant) {
      // Create participant link
      const participant = new WorkspaceParticipant();
      participant.workspace = workspace;
      participant.user = user;
      participant.workspaceId = workspace.id;
      participant.userId = user.id;
      await this.participantRepository.save(participant);

      // Create activity log
      const activityLog = new ActivityLog();
      activityLog.eventType = ActivityEventType.USER_JOINED;
      activityLog.workspace = workspace;
      activityLog.user = user;
      activityLog.metadata = { name: user.name };
      await this.logRepository.save(activityLog);
    }

    return workspace;
  }

  async getWorkspace(workspaceId: string, userId: string) {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: { notes: { tags: true }, createdBy: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Verify user is a participant
    const isParticipant = await this.participantRepository.findOne({
      where: { workspaceId, userId },
    });

    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this workspace.');
    }

    // Sort notes
    if (workspace.notes) {
      workspace.notes.sort((a, b) => a.order - b.order);
      workspace.notes.forEach((n: any) => {
        n.workspace = undefined;
      });
    }

    // Get last 50 activity logs
    const activityLogs = await this.logRepository.find({
      where: { workspace: { id: workspaceId } },
      order: { createdAt: 'DESC' },
      take: 50,
      relations: { user: true },
    });

    // Populate user names in metadata if missing or for rendering display
    const formattedLogs = activityLogs.map((log) => ({
      id: log.id,
      eventType: log.eventType,
      createdAt: log.createdAt,
      metadata: log.metadata || { name: log.user?.name || 'Unknown' },
    }));

    return {
      id: workspace.id,
      name: workspace.name,
      code: workspace.code,
      createdAt: workspace.createdAt,
      isArchived: workspace.isArchived,
      archivedAt: workspace.archivedAt,
      createdBy: {
        id: workspace.createdBy.id,
        name: workspace.createdBy.name,
      },
      notes: workspace.notes || [],
      activityLogs: formattedLogs,
    };
  }

  async searchNotes(workspaceId: string, userId: string, query: string) {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const isParticipant = await this.participantRepository.findOne({
      where: { workspaceId, userId },
    });
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this workspace.');
    }

    const keyword = query.trim();

    const notes = await this.noteRepository.createQueryBuilder('note')
      .leftJoinAndSelect('note.tags', 'tag')
      .where('note.workspaceId = :workspaceId', { workspaceId })
      .andWhere('(note.content ILIKE :keyword OR note.title ILIKE :keyword)', { keyword: `%${keyword}%` })
      .take(20)
      .getMany();

    return notes.map(note => {
      const plainText = tiptapJsonToPlainText(note.content);
      const snippet = getSnippet(plainText, keyword, 150);
      return {
        id: note.id,
        title: note.title,
        snippet,
        tags: note.tags || [],
      };
    });
  }

  async getUserWorkspaces(userId: string, archived = false) {
    const participants = await this.participantRepository.find({
      where: { userId, workspace: { isArchived: archived } },
      relations: { workspace: { createdBy: true } },
      order: { joinedAt: 'DESC' },
    });

    return participants.map((p) => ({
      id: p.workspace.id,
      name: p.workspace.name,
      code: p.workspace.code,
      joinedAt: p.joinedAt,
      isCreator: p.workspace.createdBy.id === userId,
      isArchived: p.workspace.isArchived,
    }));
  }

  // --- Sprint 8: Notes Management ---

  async createNote(workspaceId: string, userId: string, title: string = 'Untitled Note', content?: string) {
    // 1. Verify user is a participant
    const isParticipant = await this.participantRepository.findOne({
      where: { workspaceId, userId },
    });
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this workspace.');
    }

    // 2. Find max order
    const notes = await this.noteRepository.find({
      where: { workspace: { id: workspaceId } },
      order: { order: 'DESC' },
      take: 1,
    });
    const maxOrder = notes.length > 0 ? notes[0].order : -1;

    // 3. Find Workspace
    const workspace = await this.workspaceRepository.findOne({ where: { id: workspaceId } });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // 4. Create Note
    const note = new Note();
    note.title = title || 'Untitled Note';
    note.order = maxOrder + 1;
    note.content = content || '{"type":"doc","content":[{"type":"paragraph"}]}';
    note.ydocState = null;
    note.workspace = workspace;
    const savedNote = await this.noteRepository.save(note);

    // 5. Log NOTE_CREATED activity
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      const log = new ActivityLog();
      log.eventType = ActivityEventType.NOTE_CREATED;
      log.workspace = workspace;
      log.user = user;
      log.metadata = { name: user.name, noteTitle: savedNote.title };
      await this.logRepository.save(log);

      // Broadcast activity log update
      this.collaborationGateway.broadcastToRoom(workspaceId, 'activity_log_added', {
        id: log.id,
        eventType: log.eventType,
        createdAt: log.createdAt,
        metadata: log.metadata,
      });
    }

    // 6. Broadcast note_created socket event
    const serializedNote = { ...savedNote };
    delete (serializedNote as any).workspace;
    this.collaborationGateway.broadcastToRoom(workspaceId, 'note_created', {
      note: serializedNote,
    });

    return serializedNote;
  }

  async renameNote(noteId: string, workspaceId: string, userId: string, title: string) {
    if (!title || !title.trim()) {
      throw new BadRequestException('Note title cannot be empty.');
    }

    // 1. Verify note belongs to workspace
    const note = await this.noteRepository.findOne({
      where: { id: noteId, workspace: { id: workspaceId } },
    });
    if (!note) {
      throw new NotFoundException('Note not found in this workspace.');
    }

    // 2. Verify user is participant
    const isParticipant = await this.participantRepository.findOne({
      where: { workspaceId, userId },
    });
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this workspace.');
    }

    // 3. Update title
    note.title = title.trim();
    const savedNote = await this.noteRepository.save(note);
    delete (savedNote as any).workspace;

    // 4. Broadcast note_rename event
    this.collaborationGateway.broadcastToRoom(workspaceId, 'note_rename', {
      noteId,
      title: savedNote.title,
    });

    return savedNote;
  }

  async deleteNote(noteId: string, workspaceId: string, userId: string) {
    // 1. Verify note belongs to workspace
    const note = await this.noteRepository.findOne({
      where: { id: noteId, workspace: { id: workspaceId } },
    });
    if (!note) {
      throw new NotFoundException('Note not found in this workspace.');
    }

    // 2. Verify user is participant
    const isParticipant = await this.participantRepository.findOne({
      where: { workspaceId, userId },
    });
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this workspace.');
    }

    // 3. Check workspace has more than 1 note
    const count = await this.noteRepository.count({
      where: { workspace: { id: workspaceId } },
    });
    if (count <= 1) {
      throw new BadRequestException('Cannot delete the last note in a workspace.');
    }

    // 4. Find first remaining note to act as fallback
    const remainingNotes = await this.noteRepository.find({
      where: { workspace: { id: workspaceId } },
      order: { order: 'ASC' },
    });
    const fallbackNote = remainingNotes.find((n) => n.id !== noteId);
    const fallbackNoteId = fallbackNote ? fallbackNote.id : '';

    // 5. Delete note record
    await this.noteRepository.remove(note);

    // 6. Remove Yjs in-memory document
    this.ydocStore.destroy(noteId);

    // 7. Log NOTE_DELETED activity
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      const log = new ActivityLog();
      log.eventType = ActivityEventType.NOTE_DELETED;
      log.workspace = { id: workspaceId } as Workspace;
      log.user = user;
      log.metadata = { name: user.name, noteTitle: note.title };
      await this.logRepository.save(log);

      // Broadcast activity log
      this.collaborationGateway.broadcastToRoom(workspaceId, 'activity_log_added', {
        id: log.id,
        eventType: log.eventType,
        createdAt: log.createdAt,
        metadata: log.metadata,
      });
    }

    // 8. Broadcast note_deleted event to the room
    this.collaborationGateway.broadcastToRoom(workspaceId, 'note_deleted', {
      noteId,
      fallbackNoteId,
    });

    return { success: true };
  }

  // --- Sprint 8: Workspace Deletion ---

  async deleteWorkspace(workspaceId: string, userId: string) {
    // 1. Verify workspace exists and user is creator
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: { createdBy: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.createdBy.id !== userId) {
      throw new ForbiddenException('Only the workspace creator can delete it.');
    }

    // 2. Count members affected
    const membersAffected = await this.participantRepository.count({
      where: { workspaceId },
    });

    // 3. Broadcast workspace_deleted to all room participants
    this.collaborationGateway.broadcastToRoom(workspaceId, 'workspace_deleted', {
      workspaceId,
      workspaceName: workspace.name,
    });

    // 4. Delete workspace (cascades to notes, participants, activity logs)
    await this.workspaceRepository.remove(workspace);

    return { success: true, membersAffected };
  }

  // --- Sprint 8: Member Management ---

  async removeMember(workspaceId: string, targetUserId: string, requestingUserId: string) {
    // 1. Verify requesting user is the creator
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: { createdBy: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.createdBy.id !== requestingUserId) {
      throw new ForbiddenException('Only the workspace creator can remove members.');
    }

    // 2. Prevent creator from removing themselves
    if (targetUserId === requestingUserId) {
      throw new BadRequestException('The workspace creator cannot remove themselves.');
    }

    // 3. Find target participant
    const participant = await this.participantRepository.findOne({
      where: { workspaceId, userId: targetUserId },
      relations: { user: true },
    });

    if (!participant) {
      throw new NotFoundException('Member not found in this workspace.');
    }

    const removedUserName = participant.user.name;

    // 4. Delete participant record
    await this.participantRepository.remove(participant);

    // 5. Log MEMBER_REMOVED activity
    const requester = await this.userRepository.findOne({ where: { id: requestingUserId } });
    if (requester) {
      const log = new ActivityLog();
      log.eventType = ActivityEventType.MEMBER_REMOVED;
      log.workspace = workspace;
      log.user = requester;
      log.metadata = { name: requester.name, removedUserName };
      await this.logRepository.save(log);

      // Broadcast activity log
      this.collaborationGateway.broadcastToRoom(workspaceId, 'activity_log_added', {
        id: log.id,
        eventType: log.eventType,
        createdAt: log.createdAt,
        metadata: log.metadata,
      });
    }

    // 6. Broadcast member_removed event
    this.collaborationGateway.broadcastToRoom(workspaceId, 'member_removed', {
      removedUserId: targetUserId,
      workspaceId,
    });

    return { success: true };
  }

  async leaveWorkspace(workspaceId: string, userId: string) {
    // 1. Verify workspace exists
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: { createdBy: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // 2. Prevent creator from leaving
    if (workspace.createdBy.id === userId) {
      throw new BadRequestException('The workspace creator cannot leave the workspace. You must delete the workspace instead.');
    }

    // 3. Find participant record
    const participant = await this.participantRepository.findOne({
      where: { workspaceId, userId },
      relations: { user: true },
    });

    if (!participant) {
      throw new NotFoundException('You are not a member of this workspace.');
    }

    // 4. Delete participant record
    await this.participantRepository.remove(participant);

    // 5. Log USER_LEFT activity
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      const log = new ActivityLog();
      log.eventType = ActivityEventType.USER_LEFT;
      log.workspace = workspace;
      log.user = user;
      log.metadata = { name: user.name };
      await this.logRepository.save(log);

      // Broadcast activity log
      this.collaborationGateway.broadcastToRoom(workspaceId, 'activity_log_added', {
        id: log.id,
        eventType: log.eventType,
        createdAt: log.createdAt,
        metadata: log.metadata,
      });
    }

    // 6. Broadcast member_removed event to notify the user and other members
    this.collaborationGateway.broadcastToRoom(workspaceId, 'member_removed', {
      removedUserId: userId,
      workspaceId,
    });

    return { success: true };
  }

  async getWorkspaceMembers(workspaceId: string, userId: string) {
    // 1. Verify requesting user is participant
    const isParticipant = await this.participantRepository.findOne({
      where: { workspaceId, userId },
    });

    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this workspace.');
    }

    // 2. Find workspace creator ID
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: { createdBy: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // 3. Find participants with User joined
    const participants = await this.participantRepository.find({
      where: { workspaceId },
      relations: { user: true },
      order: { joinedAt: 'ASC' },
    });

    return participants.map((p) => ({
      userId: p.user.id,
      name: p.user.name,
      email: p.user.email,
      joinedAt: p.joinedAt,
      isCreator: p.user.id === workspace.createdBy.id,
    }));
  }

  async lockNote(workspaceId: string, noteId: string, userId: string) {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: { createdBy: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    if (workspace.createdBy.id !== userId) {
      throw new ForbiddenException('Only the workspace creator can lock notes.');
    }

    const note = await this.noteRepository.findOne({
      where: { id: noteId, workspace: { id: workspaceId } },
    });
    if (!note) {
      throw new NotFoundException('Note not found in this workspace.');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    note.isLocked = true;
    note.lockedById = userId;
    note.lockedAt = new Date();
    const saved = await this.noteRepository.save(note);

    const log = new ActivityLog();
    log.eventType = ActivityEventType.NOTE_LOCKED;
    log.workspace = workspace;
    log.user = user;
    log.metadata = { name: user.name, noteTitle: note.title };
    const savedLog = await this.logRepository.save(log);

    this.collaborationGateway.broadcastToRoom(workspaceId, 'activity_log_added', {
      id: savedLog.id,
      eventType: savedLog.eventType,
      createdAt: savedLog.createdAt,
      metadata: savedLog.metadata,
    });

    this.collaborationGateway.broadcastToRoom(workspaceId, 'note_locked', {
      noteId,
      lockedBy: { userId, name: user.name },
    });

    const participants = await this.participantRepository.find({ where: { workspaceId } });
    const userIdsToNotify = participants
      .map(p => p.userId)
      .filter(id => id !== userId);

    await this.notificationsService.createBulkNotifications(
      userIdsToNotify,
      workspaceId,
      noteId,
      ActivityEventType.NOTE_LOCKED,
      `${user.name} locked the note "${note.title}"`,
    );

    return saved;
  }

  async unlockNote(workspaceId: string, noteId: string, userId: string) {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: { createdBy: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    if (workspace.createdBy.id !== userId) {
      throw new ForbiddenException('Only the workspace creator can unlock notes.');
    }

    const note = await this.noteRepository.findOne({
      where: { id: noteId, workspace: { id: workspaceId } },
    });
    if (!note) {
      throw new NotFoundException('Note not found in this workspace.');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    note.isLocked = false;
    note.lockedById = null;
    note.lockedAt = null;
    const saved = await this.noteRepository.save(note);

    const log = new ActivityLog();
    log.eventType = ActivityEventType.NOTE_UNLOCKED;
    log.workspace = workspace;
    log.user = user;
    log.metadata = { name: user.name, noteTitle: note.title };
    const savedLog = await this.logRepository.save(log);

    this.collaborationGateway.broadcastToRoom(workspaceId, 'activity_log_added', {
      id: savedLog.id,
      eventType: savedLog.eventType,
      createdAt: savedLog.createdAt,
      metadata: savedLog.metadata,
    });

    this.collaborationGateway.broadcastToRoom(workspaceId, 'note_unlocked', {
      noteId,
    });

    const participants = await this.participantRepository.find({ where: { workspaceId } });
    const userIdsToNotify = participants
      .map(p => p.userId)
      .filter(id => id !== userId);

    await this.notificationsService.createBulkNotifications(
      userIdsToNotify,
      workspaceId,
      noteId,
      ActivityEventType.NOTE_UNLOCKED,
      `${user.name} unlocked the note "${note.title}"`,
    );

    return saved;
  }

  async pinNote(workspaceId: string, noteId: string, userId: string) {
    const isParticipant = await this.participantRepository.findOne({
      where: { workspaceId, userId },
    });
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this workspace.');
    }

    const note = await this.noteRepository.findOne({
      where: { id: noteId, workspace: { id: workspaceId } },
    });
    if (!note) {
      throw new NotFoundException('Note not found in this workspace.');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    note.isPinned = true;
    note.pinnedAt = new Date();
    const saved = await this.noteRepository.save(note);

    const log = new ActivityLog();
    log.eventType = ActivityEventType.NOTE_PINNED;
    log.workspace = { id: workspaceId } as Workspace;
    log.user = user;
    log.metadata = { name: user.name, noteTitle: note.title };
    const savedLog = await this.logRepository.save(log);

    this.collaborationGateway.broadcastToRoom(workspaceId, 'activity_log_added', {
      id: savedLog.id,
      eventType: savedLog.eventType,
      createdAt: savedLog.createdAt,
      metadata: savedLog.metadata,
    });

    this.collaborationGateway.broadcastToRoom(workspaceId, 'note_pinned', {
      noteId,
      isPinned: true,
    });

    const participants = await this.participantRepository.find({ where: { workspaceId } });
    const userIdsToNotify = participants
      .map(p => p.userId)
      .filter(id => id !== userId);

    await this.notificationsService.createBulkNotifications(
      userIdsToNotify,
      workspaceId,
      noteId,
      ActivityEventType.NOTE_PINNED,
      `${user.name} pinned the note "${note.title}"`,
    );

    return saved;
  }

  async unpinNote(workspaceId: string, noteId: string, userId: string) {
    const isParticipant = await this.participantRepository.findOne({
      where: { workspaceId, userId },
    });
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this workspace.');
    }

    const note = await this.noteRepository.findOne({
      where: { id: noteId, workspace: { id: workspaceId } },
    });
    if (!note) {
      throw new NotFoundException('Note not found in this workspace.');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    note.isPinned = false;
    note.pinnedAt = null;
    const saved = await this.noteRepository.save(note);

    const log = new ActivityLog();
    log.eventType = ActivityEventType.NOTE_UNPINNED;
    log.workspace = { id: workspaceId } as Workspace;
    log.user = user;
    log.metadata = { name: user.name, noteTitle: note.title };
    const savedLog = await this.logRepository.save(log);

    this.collaborationGateway.broadcastToRoom(workspaceId, 'activity_log_added', {
      id: savedLog.id,
      eventType: savedLog.eventType,
      createdAt: savedLog.createdAt,
      metadata: savedLog.metadata,
    });

    this.collaborationGateway.broadcastToRoom(workspaceId, 'note_unpinned', {
      noteId,
    });

    return saved;
  }

  async archiveWorkspace(workspaceId: string, userId: string) {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: { createdBy: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    if (workspace.createdBy.id !== userId) {
      throw new ForbiddenException('Only the workspace creator can archive it.');
    }

    workspace.isArchived = true;
    workspace.archivedAt = new Date();
    const saved = await this.workspaceRepository.save(workspace);

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      const log = new ActivityLog();
      log.eventType = ActivityEventType.WORKSPACE_ARCHIVED;
      log.workspace = workspace;
      log.user = user;
      log.metadata = { name: user.name, workspaceName: workspace.name };
      const savedLog = await this.logRepository.save(log);

      this.collaborationGateway.broadcastToRoom(workspaceId, 'activity_log_added', {
        id: savedLog.id,
        eventType: savedLog.eventType,
        createdAt: savedLog.createdAt,
        metadata: savedLog.metadata,
      });
    }

    this.collaborationGateway.broadcastToRoom(workspaceId, 'workspace_archived', {
      workspaceId,
      workspaceName: workspace.name,
    });

    const participants = await this.participantRepository.find({ where: { workspaceId } });
    const userIdsToNotify = participants
      .map(p => p.userId)
      .filter(id => id !== userId);

    await this.notificationsService.createBulkNotifications(
      userIdsToNotify,
      workspaceId,
      null,
      ActivityEventType.WORKSPACE_ARCHIVED,
      `${workspace.name} was archived by the creator`,
    );

    return saved;
  }

  async unarchiveWorkspace(workspaceId: string, userId: string) {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: { createdBy: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    if (workspace.createdBy.id !== userId) {
      throw new ForbiddenException('Only the workspace creator can unarchive it.');
    }

    workspace.isArchived = false;
    workspace.archivedAt = null;
    const saved = await this.workspaceRepository.save(workspace);

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      const log = new ActivityLog();
      log.eventType = ActivityEventType.WORKSPACE_UNARCHIVED;
      log.workspace = workspace;
      log.user = user;
      log.metadata = { name: user.name, workspaceName: workspace.name };
      const savedLog = await this.logRepository.save(log);

      this.collaborationGateway.broadcastToRoom(workspaceId, 'activity_log_added', {
        id: savedLog.id,
        eventType: savedLog.eventType,
        createdAt: savedLog.createdAt,
        metadata: savedLog.metadata,
      });
    }

    this.collaborationGateway.broadcastToRoom(workspaceId, 'workspace_unarchived', {
      workspaceId,
    });

    return saved;
  }

  async getTags(workspaceId: string, userId: string) {
    const isParticipant = await this.participantRepository.findOne({
      where: { workspaceId, userId },
    });
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this workspace.');
    }

    return this.tagRepository.find({
      where: { workspaceId },
      order: { createdAt: 'ASC' },
    });
  }

  async createTag(workspaceId: string, userId: string, name: string, color: string) {
    const isParticipant = await this.participantRepository.findOne({
      where: { workspaceId, userId },
    });
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this workspace.');
    }

    if (!name || name.trim().length === 0 || name.trim().length > 30) {
      throw new BadRequestException('Tag name must be between 1 and 30 characters.');
    }

    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    if (!color || !hexRegex.test(color)) {
      throw new BadRequestException('Tag color must be a valid 6-character hex color starting with #.');
    }

    const existing = await this.tagRepository.findOne({
      where: { workspaceId, name: name.trim() },
    });
    if (existing) {
      throw new BadRequestException('A tag with this name already exists in the workspace.');
    }

    const workspace = await this.workspaceRepository.findOne({ where: { id: workspaceId } });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const tag = new Tag();
    tag.name = name.trim();
    tag.color = color;
    tag.workspace = workspace;
    tag.workspaceId = workspace.id;
    const saved = await this.tagRepository.save(tag);

    this.collaborationGateway.broadcastToRoom(workspaceId, 'tag_created', { tag: saved });

    return saved;
  }

  async deleteTag(workspaceId: string, tagId: string, userId: string) {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: { createdBy: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    if (workspace.createdBy.id !== userId) {
      throw new ForbiddenException('Only the workspace creator can delete tags.');
    }

    const tag = await this.tagRepository.findOne({
      where: { id: tagId, workspaceId },
    });
    if (!tag) {
      throw new NotFoundException('Tag not found in this workspace.');
    }

    await this.tagRepository.remove(tag);

    this.collaborationGateway.broadcastToRoom(workspaceId, 'tag_deleted', { tagId });

    return { success: true };
  }

  async applyTagToNote(workspaceId: string, noteId: string, tagId: string, userId: string) {
    const isParticipant = await this.participantRepository.findOne({
      where: { workspaceId, userId },
    });
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this workspace.');
    }

    const note = await this.noteRepository.findOne({
      where: { id: noteId, workspaceId },
      relations: { tags: true },
    });
    if (!note) {
      throw new NotFoundException('Note not found in this workspace.');
    }

    const tag = await this.tagRepository.findOne({
      where: { id: tagId, workspaceId },
    });
    if (!tag) {
      throw new NotFoundException('Tag not found in this workspace.');
    }

    if (note.tags.some(t => t.id === tagId)) {
      return note;
    }

    note.tags.push(tag);
    const saved = await this.noteRepository.save(note);

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      const log = new ActivityLog();
      log.eventType = ActivityEventType.TAG_ADDED;
      log.workspace = { id: workspaceId } as Workspace;
      log.user = user;
      log.metadata = { name: user.name, noteTitle: note.title, tagName: tag.name };
      const savedLog = await this.logRepository.save(log);

      this.collaborationGateway.broadcastToRoom(workspaceId, 'activity_log_added', {
        id: savedLog.id,
        eventType: savedLog.eventType,
        createdAt: savedLog.createdAt,
        metadata: savedLog.metadata,
      });
    }

    this.collaborationGateway.broadcastToRoom(workspaceId, 'note_tags_updated', {
      noteId,
      tags: saved.tags,
    });

    return saved;
  }

  async removeTagFromNote(workspaceId: string, noteId: string, tagId: string, userId: string) {
    const isParticipant = await this.participantRepository.findOne({
      where: { workspaceId, userId },
    });
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this workspace.');
    }

    const note = await this.noteRepository.findOne({
      where: { id: noteId, workspaceId },
      relations: { tags: true },
    });
    if (!note) {
      throw new NotFoundException('Note not found in this workspace.');
    }

    const tag = await this.tagRepository.findOne({
      where: { id: tagId, workspaceId },
    });
    if (!tag) {
      throw new NotFoundException('Tag not found in this workspace.');
    }

    if (!note.tags.some(t => t.id === tagId)) {
      return note;
    }

    note.tags = note.tags.filter(t => t.id !== tagId);
    const saved = await this.noteRepository.save(note);

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      const log = new ActivityLog();
      log.eventType = ActivityEventType.TAG_REMOVED;
      log.workspace = { id: workspaceId } as Workspace;
      log.user = user;
      log.metadata = { name: user.name, noteTitle: note.title, tagName: tag.name };
      const savedLog = await this.logRepository.save(log);

      this.collaborationGateway.broadcastToRoom(workspaceId, 'activity_log_added', {
        id: savedLog.id,
        eventType: savedLog.eventType,
        createdAt: savedLog.createdAt,
        metadata: savedLog.metadata,
      });
    }

    this.collaborationGateway.broadcastToRoom(workspaceId, 'note_tags_updated', {
      noteId,
      tags: saved.tags,
    });

    return saved;
  }

  async exportWorkspace(workspaceId: string, userId: string, res: express.Response) {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: { notes: true, createdBy: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const isParticipant = await this.participantRepository.findOne({
      where: { workspaceId, userId },
    });
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this workspace.');
    }

    const memberCount = await this.participantRepository.count({ where: { workspaceId } });

    const sanitizedWorkspaceName = workspace.name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedWorkspaceName}-export.zip"`);

    const archive = new (archiver as any).ZipArchive({ zlib: { level: 9 } });

    archive.on('error', (err) => {
      console.error('ZIP archive creation failed:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to create archive: ' + err.message });
      }
    });

    archive.pipe(res);

    const noteTitlesSeen = new Set<string>();
    for (const note of workspace.notes) {
      const plainText = tiptapJsonToPlainText(note.content);
      
      let baseTitle = note.title ? note.title.replace(/[^a-z0-9_-]/gi, '_') : 'Untitled';
      if (!baseTitle) baseTitle = 'Untitled';
      
      let finalTitle = baseTitle;
      let counter = 1;
      while (noteTitlesSeen.has(finalTitle.toLowerCase())) {
        finalTitle = `${baseTitle}_${counter}`;
        counter++;
      }
      noteTitlesSeen.add(finalTitle.toLowerCase());

      archive.append(plainText, { name: `${finalTitle}.txt` });
    }

    const infoText = `Workspace Name: ${workspace.name}
Workspace Code: ${workspace.code}
Export Date: ${new Date().toISOString()}
Member Count: ${memberCount}
`;
    archive.append(infoText, { name: 'workspace-info.txt' });

    await archive.finalize();
  }
}
