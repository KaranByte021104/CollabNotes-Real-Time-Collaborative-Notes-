import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollaborationGateway } from './collaboration.gateway';
import { YdocStoreService } from './ydoc-store.service';
import { OnlineUsersStore } from './online-users.store';
import { Workspace } from '../entities/workspace.entity';
import { Note } from '../entities/note.entity';
import { User } from '../entities/user.entity';
import { WorkspaceParticipant } from '../entities/workspace-participant.entity';
import { ActivityLog } from '../entities/activity-log.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workspace, Note, User, WorkspaceParticipant, ActivityLog]),
    AuthModule,
  ],
  providers: [CollaborationGateway, YdocStoreService, OnlineUsersStore],
  exports: [CollaborationGateway, YdocStoreService, OnlineUsersStore],
})
export class CollaborationModule {}
