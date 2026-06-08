import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notification } from '../entities/notification.entity';
import { WorkspaceParticipant } from '../entities/workspace-participant.entity';
import { User } from '../entities/user.entity';
import { CollaborationModule } from '../collaboration/collaboration.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, WorkspaceParticipant, User]),
    CollaborationModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
