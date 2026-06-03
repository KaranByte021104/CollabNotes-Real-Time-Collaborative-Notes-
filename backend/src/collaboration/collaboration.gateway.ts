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

  // Debounce map for DB saves: workspaceId -> Timeout
  private readonly saveDebounceMap = new Map<string, NodeJS.Timeout>();
  // Store latest content snapshots sent from clients: workspaceId -> content JSON string
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
      };
      
      console.log(`Socket connected: ${client.id} (User: ${user.name})`);
    } catch (err) {
      console.error(`Socket auth failed for ${client.id}:`, err.message);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Socket disconnected: ${client.id}`);
    const session = this.onlineUsersStore.findUserBySocketId(client.id);

    if (session) {
      const { workspaceId, user } = session;
      
      // Remove from online memory store
      this.onlineUsersStore.removeUser(workspaceId, user.userId);

      // Broadcast user left
      const remainingUsers = this.onlineUsersStore.getUsers(workspaceId);
      this.server.to(workspaceId).emit('user_left', {
        user,
        onlineUsers: remainingUsers,
      });

      // Save USER_LEFT activity log asynchronously
      this.saveActivityLog(workspaceId, user.userId, ActivityEventType.USER_LEFT, { name: user.name });

      // If no users left in workspace, flush save immediately
      if (remainingUsers.length === 0) {
        this.flushDatabaseSave(workspaceId);
      }
    }
  }

  @SubscribeMessage('join_workspace')
  async handleJoinWorkspace(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string },
  ) {
    const { workspaceId } = data;
    const user = client.data.user;

    if (!user) return;

    // 1. Verify user is a participant of this workspace
    const isParticipant = await this.participantRepository.findOne({
      where: { workspaceId, userId: user.userId },
    });

    if (!isParticipant) {
      client.emit('error', { message: 'Forbidden: You are not a participant of this workspace' });
      return;
    }

    // 2. Join the Socket.IO room
    client.join(workspaceId);

    // 3. Add to OnlineUsersStore
    const onlineUser = this.onlineUsersStore.addUser(workspaceId, user.userId, user.name, client.id);

    // 4. Load Note to initialize server in-memory Yjs doc
    const note = await this.noteRepository.findOne({ where: { workspace: { id: workspaceId } } });
    if (note) {
      this.ydocStore.getOrCreate(workspaceId, note.ydocState);
      if (note.content) {
        this.latestSnapshots.set(workspaceId, note.content);
      }
    } else {
      this.ydocStore.getOrCreate(workspaceId, null);
    }

    // 5. Yjs Sync Step 1: Send server state vector to client
    const stateVector = this.ydocStore.getStateVector(workspaceId);
    client.emit('sync_step1', {
      workspaceId,
      stateVector: Array.from(stateVector),
    });

    // 6. Broadcast user_joined to everyone else in the room
    const onlineUsers = this.onlineUsersStore.getUsers(workspaceId);
    client.to(workspaceId).emit('user_joined', {
      user: onlineUser,
      onlineUsers,
    });

    // 7. Log USER_JOINED to DB
    this.saveActivityLog(workspaceId, user.userId, ActivityEventType.USER_JOINED, { name: user.name });
  }

  @SubscribeMessage('sync_step2')
  async handleSyncStep2(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string; update: number[]; clientStateVector: number[] },
  ) {
    const { workspaceId, update, clientStateVector } = data;
    const user = client.data.user;
    if (!user) return;

    const updateBuffer = new Uint8Array(update);

    // 1. Apply client updates to server Y.Doc
    this.ydocStore.applyUpdate(workspaceId, updateBuffer);

    // 2. Broadcast doc_update to others in the room
    client.to(workspaceId).emit('doc_update', {
      workspaceId,
      update: Array.from(updateBuffer),
      updatedBy: { userId: user.userId, name: user.name },
    });

    // 3. Send server's missing updates back to client (sync_complete)
    const serverUpdate = this.ydocStore.getUpdate(workspaceId, new Uint8Array(clientStateVector));
    client.emit('sync_complete', {
      workspaceId,
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

    // 5. Debounce save
    this.scheduleDatabaseSave(workspaceId, user.userId, user.name);
  }

  @SubscribeMessage('doc_update')
  handleDocUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string; update: number[] },
  ) {
    const { workspaceId, update } = data;
    const user = client.data.user;
    if (!user) return;

    // Validate client is inside the socket room
    const rooms = Array.from(client.rooms);
    if (!rooms.includes(workspaceId)) {
      client.emit('error', { message: 'Forbidden: You are not active in this workspace room' });
      return;
    }

    const updateBuffer = new Uint8Array(update);

    // Apply to Y.Doc
    this.ydocStore.applyUpdate(workspaceId, updateBuffer);

    // Broadcast to others
    client.to(workspaceId).emit('doc_update', {
      workspaceId,
      update: Array.from(updateBuffer),
      updatedBy: { userId: user.userId, name: user.name },
    });

    // Debounce save
    this.scheduleDatabaseSave(workspaceId, user.userId, user.name);
  }

  @SubscribeMessage('awareness_update')
  handleAwarenessUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string; update: number[] },
  ) {
    const { workspaceId, update } = data;
    
    // Broadcast cursor/selection updates instantly to all other workspace users
    client.to(workspaceId).emit('awareness_update', {
      workspaceId,
      update,
    });
  }

  @SubscribeMessage('content_snapshot')
  handleContentSnapshot(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string; content: string },
  ) {
    const { workspaceId, content } = data;
    this.latestSnapshots.set(workspaceId, content);
  }

  private scheduleDatabaseSave(workspaceId: string, userId: string, userName: string) {
    const existingTimeout = this.saveDebounceMap.get(workspaceId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      this.executeDatabaseSave(workspaceId, userId, userName);
    }, 2000); // 2 seconds of inactivity

    this.saveDebounceMap.set(workspaceId, timeout);
  }

  private async executeDatabaseSave(workspaceId: string, userId: string, userName: string) {
    this.saveDebounceMap.delete(workspaceId);
    try {
      const fullState = this.ydocStore.encodeFullState(workspaceId);
      const note = await this.noteRepository.findOne({ where: { workspace: { id: workspaceId } } });

      if (note) {
        note.ydocState = Buffer.from(fullState);
        const snapshot = this.latestSnapshots.get(workspaceId);
        if (snapshot) {
          note.content = snapshot;
        }
        await this.noteRepository.save(note);
        
        // Log NOTE_UPDATED
        await this.saveActivityLog(workspaceId, userId, ActivityEventType.NOTE_UPDATED, { name: userName });
        console.log(`Workspace ${workspaceId} note auto-saved successfully.`);
      }
    } catch (error) {
      console.error(`Failed to auto-save workspace ${workspaceId}:`, error);
    }
  }

  private async flushDatabaseSave(workspaceId: string) {
    const timeout = this.saveDebounceMap.get(workspaceId);
    if (timeout) {
      clearTimeout(timeout);
      this.saveDebounceMap.delete(workspaceId);

      // Perform direct save
      try {
        const fullState = this.ydocStore.encodeFullState(workspaceId);
        const note = await this.noteRepository.findOne({ where: { workspace: { id: workspaceId } } });
        if (note) {
          note.ydocState = Buffer.from(fullState);
          const snapshot = this.latestSnapshots.get(workspaceId);
          if (snapshot) {
            note.content = snapshot;
          }
          await this.noteRepository.save(note);
          console.log(`Workspace ${workspaceId} note flushed to DB successfully.`);
        }
      } catch (error) {
        console.error(`Failed to flush save for workspace ${workspaceId}:`, error);
      }
    }
    this.ydocStore.destroy(workspaceId);
    this.latestSnapshots.delete(workspaceId);
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
