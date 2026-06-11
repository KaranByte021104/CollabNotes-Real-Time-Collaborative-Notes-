import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Workspace } from '../entities/workspace.entity';
import { Note } from '../entities/note.entity';
import { User } from '../entities/user.entity';
import { WorkspaceParticipant } from '../entities/workspace-participant.entity';
import { ActivityLog, ActivityEventType } from '../entities/activity-log.entity';
import { YdocStoreService } from './ydoc-store.service';
import { OnlineUsersStore } from './online-users.store';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/',
})
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Debounce map for DB saves: noteId -> Timeout
  private readonly saveDebounceMap = new Map<string, NodeJS.Timeout>();
  // Store latest content snapshots sent from clients: noteId -> content JSON string
  private readonly latestSnapshots = new Map<string, string>();

  constructor(
    private readonly ydocStore: YdocStoreService,
    private readonly onlineUsersStore: OnlineUsersStore,
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
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      if (!token) {
        throw new Error('No token provided');
      }

      const secret = this.configService.get<string>('JWT_SECRET', 'supersecretjwtsecretkeyshouldbechangedinproduction');
      const payload = this.jwtService.verify(token, { secret });

      // Load user details
      const user = await this.userRepository.findOne({ where: { id: payload.sub } });
      if (!user) {
        throw new Error('User not found');
      }

      // Store authenticated user on the client socket state
      client.data.user = {
        userId: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      };

      await client.join('user:' + user.id);
      
      console.log(`Socket connected: ${client.id} (User: ${user.name})`);
    } catch (err) {
      console.error(`Socket auth failed for ${client.id}:`, err.message);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    console.log(`Socket disconnected: ${client.id}`);
    const session = this.onlineUsersStore.findUserBySocketId(client.id);

    if (session) {
      const { workspaceId, user } = session;
      
      // Remove from online memory store
      this.onlineUsersStore.removeUser(workspaceId, user.userId);

      // Broadcast user left
      // Broadcast user left
      const remainingUsers = this.onlineUsersStore.getUsers(workspaceId);
      this.server.to(workspaceId).emit('user_left', {
        user,
        onlineUsers: remainingUsers,
      });

      // If no users left in workspace, flush all workspace note saves immediately and clear memory
      if (remainingUsers.length === 0) {
        await this.flushAllWorkspaceNotes(workspaceId);
      }
    }
  }

  @SubscribeMessage('join_workspace')
  async handleJoinWorkspace(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string; noteId?: string },
  ) {
    const { workspaceId, noteId } = data;
    const user = client.data.user;

    if (!user) {
      console.log('Gateway: join_workspace rejected - no user on client socket');
      return;
    }

    console.log(`Gateway: join_workspace received for workspace: ${workspaceId}, note: ${noteId} from user: ${user.name} (${user.userId})`);

    // 1. Verify user is a participant of this workspace
    const isParticipant = await this.participantRepository.findOne({
      where: { workspaceId, userId: user.userId },
    });

    if (!isParticipant) {
      console.warn(`Gateway: join_workspace FORBIDDEN - user ${user.name} is not a participant of workspace ${workspaceId}`);
      client.emit('error', { message: 'Forbidden: You are not a participant of this workspace' });
      return;
    }

    console.log(`Gateway: user ${user.name} is verified participant. Joining socket room...`);

    // 2. Join the Socket.IO room
    client.join(workspaceId);

    // 3. Add to OnlineUsersStore
    const onlineUser = this.onlineUsersStore.addUser(workspaceId, user.userId, user.name, client.id, user.avatarUrl);

    // 4. Resolve correct active note ID
    let activeNoteId = noteId;
    if (!activeNoteId) {
      // Find fallback note with lowest order
      const notes = await this.noteRepository.find({
        where: { workspace: { id: workspaceId } },
        order: { order: 'ASC' },
        take: 1,
      });
      if (notes.length > 0) {
        activeNoteId = notes[0].id;
      }
    }

    if (activeNoteId) {
      const note = await this.noteRepository.findOne({ where: { id: activeNoteId } });
      if (note) {
        this.ydocStore.getOrCreate(activeNoteId, note.ydocState, note.content);
        if (note.content) {
          this.latestSnapshots.set(activeNoteId, note.content);
        }
      }
    }

    // 5. Yjs Sync Step 1: Send server state vector to client
    if (activeNoteId) {
      const stateVector = this.ydocStore.getStateVector(activeNoteId);
      client.emit('sync_step1', {
        workspaceId,
        noteId: activeNoteId,
        stateVector: Array.from(stateVector),
      });
    }

    // 6. Broadcast user_joined to everyone else in the room
    const onlineUsers = this.onlineUsersStore.getUsers(workspaceId);
    client.to(workspaceId).emit('user_joined', {
      user: onlineUser,
      onlineUsers,
    });
  }

  @SubscribeMessage('sync_step2')
  async handleSyncStep2(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string; noteId: string; update: number[]; clientStateVector: number[] },
  ) {
    const { workspaceId, noteId, update, clientStateVector } = data;
    const user = client.data.user;
    if (!user) return;

    console.log(`Gateway: sync_step2 received from user ${user.name} for noteId ${noteId}`);

    const updateBuffer = new Uint8Array(update);

    // 1. Apply client updates to server Y.Doc
    this.ydocStore.applyUpdate(noteId, updateBuffer);

    if (updateBuffer.length > 2) {
      // 2. Broadcast doc_update to others in the room
      client.to(workspaceId).emit('doc_update', {
        workspaceId,
        noteId,
        update: Array.from(updateBuffer),
        updatedBy: { userId: user.userId, name: user.name },
      });
    }

    // 3. Send server's missing updates back to client (sync_complete)
    const serverUpdate = this.ydocStore.getUpdate(noteId, new Uint8Array(clientStateVector));
    client.emit('sync_complete', {
      workspaceId,
      noteId,
      update: Array.from(serverUpdate),
    });

    // 4. Emit workspace_meta back to client
    const onlineUsers = this.onlineUsersStore.getUsers(workspaceId);
    const activityLogs = await this.logRepository.find({
      where: { workspace: { id: workspaceId } },
      order: { createdAt: 'DESC' },
      take: 50,
      relations: { user: true },
    });

    const formattedLogs = activityLogs.map((log) => ({
      id: log.id,
      eventType: log.eventType,
      createdAt: log.createdAt,
      metadata: log.metadata || { name: log.user?.name || 'Unknown' },
    }));

    client.emit('workspace_meta', {
      onlineUsers,
      activityLogs: formattedLogs,
    });

    // 5. Debounce save (only if there was an actual change)
    if (updateBuffer.length > 2) {
      this.scheduleDatabaseSave(noteId, user.userId, user.name, workspaceId);
    }
  }

  @SubscribeMessage('doc_update')
  handleDocUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string; noteId: string; update: number[] },
  ) {
    const { workspaceId, noteId, update } = data;
    const user = client.data.user;
    if (!user) return;

    // Validate client is inside the socket room
    const rooms = Array.from(client.rooms);
    if (!rooms.includes(workspaceId)) {
      client.emit('error', { message: 'Forbidden: You are not active in this workspace room' });
      return;
    }

    const updateBuffer = new Uint8Array(update);
    if (updateBuffer.length <= 2) return;

    // Apply to Y.Doc
    this.ydocStore.applyUpdate(noteId, updateBuffer);

    // Broadcast to others
    client.to(workspaceId).emit('doc_update', {
      workspaceId,
      noteId,
      update: Array.from(updateBuffer),
      updatedBy: { userId: user.userId, name: user.name },
    });

    // Debounce save
    this.scheduleDatabaseSave(noteId, user.userId, user.name, workspaceId);
  }

  @SubscribeMessage('awareness_update')
  handleAwarenessUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string; noteId: string; update: number[] },
  ) {
    const { workspaceId, noteId, update } = data;
    
    // Broadcast cursor/selection updates instantly to all other workspace users
    client.to(workspaceId).emit('awareness_update', {
      workspaceId,
      noteId,
      update,
    });
  }

  @SubscribeMessage('content_snapshot')
  handleContentSnapshot(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string; noteId: string; content: string },
  ) {
    const { noteId, content } = data;
    this.latestSnapshots.set(noteId, content);
  }

  // --- Public Broadcast Endpoint for Services ---

  broadcastToRoom(roomId: string, event: string, payload: any) {
    if (this.server) {
      this.server.to(roomId).emit(event, payload);
    }
  }

  // --- Database Save Operations ---

  private scheduleDatabaseSave(noteId: string, userId: string, userName: string, workspaceId: string) {
    const existingTimeout = this.saveDebounceMap.get(noteId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      this.executeDatabaseSave(noteId, userId, userName, workspaceId);
    }, 2000); // 2 seconds of inactivity

    this.saveDebounceMap.set(noteId, timeout);
  }

  private async executeDatabaseSave(noteId: string, userId: string, userName: string, workspaceId: string) {
    this.saveDebounceMap.delete(noteId);
    try {
      const fullState = this.ydocStore.encodeFullState(noteId);
      const note = await this.noteRepository.findOne({ where: { id: noteId } });

      if (note) {
        const oldYdocState = note.ydocState;
        const newYdocState = Buffer.from(fullState);

        // Avoid database save and activity log if the state and content did not change
        if (oldYdocState && oldYdocState.equals(newYdocState)) {
          const snapshot = this.latestSnapshots.get(noteId);
          if (!snapshot || note.content === snapshot) {
            console.log(`Note ${noteId} had no changes. Skipping DB save & activity log.`);
            return;
          }
        }

        note.ydocState = newYdocState;
        const snapshot = this.latestSnapshots.get(noteId);
        if (snapshot) {
          note.content = snapshot;
        }
        await this.noteRepository.save(note);
        
        // Log NOTE_UPDATED
        await this.saveActivityLog(workspaceId, userId, ActivityEventType.NOTE_UPDATED, { name: userName });
        console.log(`Note ${noteId} auto-saved successfully.`);
      }
    } catch (error) {
      console.error(`Failed to auto-save note ${noteId}:`, error);
    }
  }

  private async flushDatabaseSave(noteId: string) {
    const timeout = this.saveDebounceMap.get(noteId);
    if (timeout) {
      clearTimeout(timeout);
      this.saveDebounceMap.delete(noteId);
    }

    // Perform direct save
    try {
      const fullState = this.ydocStore.encodeFullState(noteId);
      const note = await this.noteRepository.findOne({ where: { id: noteId } });
      if (note) {
        note.ydocState = Buffer.from(fullState);
        const snapshot = this.latestSnapshots.get(noteId);
        if (snapshot) {
          note.content = snapshot;
        }
        await this.noteRepository.save(note);
        console.log(`Note ${noteId} flushed to DB successfully.`);
      }
    } catch (error) {
      console.error(`Failed to flush save for note ${noteId}:`, error);
    }
    
    this.ydocStore.destroy(noteId);
    this.latestSnapshots.delete(noteId);
  }

  private async flushAllWorkspaceNotes(workspaceId: string) {
    try {
      const notes = await this.noteRepository.find({
        where: { workspace: { id: workspaceId } }
      });
      for (const note of notes) {
        if (this.saveDebounceMap.has(note.id)) {
          await this.flushDatabaseSave(note.id);
        } else {
          this.ydocStore.destroy(note.id);
          this.latestSnapshots.delete(note.id);
        }
      }
      console.log(`Flushed and cleaned all cached notes for workspace ${workspaceId}.`);
    } catch (error) {
      console.error(`Failed to flush all notes for workspace ${workspaceId}:`, error);
    }
  }

  private async saveActivityLog(workspaceId: string, userId: string, eventType: ActivityEventType, metadata: any) {
    try {
      const workspace = await this.workspaceRepository.findOne({ where: { id: workspaceId } });
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (workspace && user) {
        const log = new ActivityLog();
        log.eventType = eventType;
        log.workspace = workspace;
        log.user = user;
        log.metadata = metadata;
        const savedLog = await this.logRepository.save(log);

        // Broadcast the new log to everyone in the workspace in real-time
        this.server.to(workspaceId).emit('activity_log_added', {
          id: savedLog.id,
          eventType: savedLog.eventType,
          createdAt: savedLog.createdAt,
          metadata: savedLog.metadata || { name: user.name },
        });
      }
    } catch (err) {
      console.error('Failed to create background activity log:', err);
    }
  }
}
