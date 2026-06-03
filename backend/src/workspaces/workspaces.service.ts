import { Injectable, NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workspace } from '../entities/workspace.entity';
import { Note } from '../entities/note.entity';
import { User } from '../entities/user.entity';
import { WorkspaceParticipant } from '../entities/workspace-participant.entity';
import { ActivityLog, ActivityEventType } from '../entities/activity-log.entity';
import { generateCode } from '../common/utils/generate-code';

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

    // Create and save note
    const note = new Note();
    note.content = '{"type":"doc","content":[{"type":"paragraph"}]}';
    note.ydocState = null;
    note.workspace = savedWorkspace;
    const savedNote = await this.noteRepository.save(note);
    savedWorkspace.note = savedNote;

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
    if (savedWorkspace.note) {
      (savedWorkspace.note as any).workspace = undefined;
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
      relations: { note: true },
    });

    if (!workspace) {
      throw new NotFoundException('No workspace found with that code. Please check and try again.');
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
      relations: { note: true, createdBy: true },
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
      createdBy: {
        id: workspace.createdBy.id,
        name: workspace.createdBy.name,
      },
      note: workspace.note,
      activityLogs: formattedLogs,
    };
  }

  async getUserWorkspaces(userId: string) {
    const participants = await this.participantRepository.find({
      where: { userId },
      relations: { workspace: true },
      order: { joinedAt: 'DESC' },
    });

    return participants.map((p) => ({
      id: p.workspace.id,
      name: p.workspace.name,
      code: p.workspace.code,
      joinedAt: p.joinedAt,
    }));
  }
}
