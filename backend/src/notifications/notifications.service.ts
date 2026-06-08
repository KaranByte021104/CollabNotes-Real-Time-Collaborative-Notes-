import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { WorkspaceParticipant } from '../entities/workspace-participant.entity';
import { User } from '../entities/user.entity';
import { ActivityEventType } from '../entities/activity-log.entity';
import { CollaborationGateway } from '../collaboration/collaboration.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(WorkspaceParticipant)
    private readonly participantRepository: Repository<WorkspaceParticipant>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly collaborationGateway: CollaborationGateway,
  ) {}

  async createNotification(
    userId: string,
    workspaceId: string | null,
    noteId: string | null,
    eventType: ActivityEventType,
    message: string,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return null;

    const notification = new Notification();
    notification.userId = userId;
    notification.workspaceId = workspaceId;
    notification.noteId = noteId;
    notification.eventType = eventType;
    notification.message = message;
    notification.isRead = false;

    const saved = await this.notificationRepository.save(notification);

    const result = await this.notificationRepository.findOne({
      where: { id: saved.id },
      relations: { workspace: true },
    });

    this.collaborationGateway.broadcastToRoom('user:' + userId, 'new_notification', {
      notification: result,
    });

    return result;
  }

  async createBulkNotifications(
    userIds: string[],
    workspaceId: string | null,
    noteId: string | null,
    eventType: ActivityEventType,
    message: string,
  ) {
    const notifications: Notification[] = [];
    for (const userId of userIds) {
      const notification = new Notification();
      notification.userId = userId;
      notification.workspaceId = workspaceId;
      notification.noteId = noteId;
      notification.eventType = eventType;
      notification.message = message;
      notification.isRead = false;
      notifications.push(notification);
    }

    if (notifications.length === 0) return [];

    const savedList = await this.notificationRepository.save(notifications);

    for (const saved of savedList) {
      const populated = await this.notificationRepository.findOne({
        where: { id: saved.id },
        relations: { workspace: true },
      });
      if (populated) {
        this.collaborationGateway.broadcastToRoom('user:' + saved.userId, 'new_notification', {
          notification: populated,
        });
      }
    }

    return savedList;
  }

  async getNotifications(userId: string) {
    return this.notificationRepository.find({
      where: { userId },
      relations: { workspace: true },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.notificationRepository.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    notification.isRead = true;
    return this.notificationRepository.save(notification);
  }

  async markAllAsRead(userId: string) {
    await this.notificationRepository.update({ userId, isRead: false }, { isRead: true });
    return { success: true };
  }
}
