import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { Workspace } from '../entities/workspace.entity';
import { Note } from '../entities/note.entity';
import { User } from '../entities/user.entity';
import { WorkspaceParticipant } from '../entities/workspace-participant.entity';
import { ActivityLog } from '../entities/activity-log.entity';
import { AuthModule } from '../auth/auth.module';
import { CollaborationModule } from '../collaboration/collaboration.module';

import { Tag } from '../entities/tag.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workspace, Note, User, WorkspaceParticipant, ActivityLog, Tag]),
    AuthModule,
    CollaborationModule,
    NotificationsModule,
  ],
  providers: [WorkspacesService],
  controllers: [WorkspacesController],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
