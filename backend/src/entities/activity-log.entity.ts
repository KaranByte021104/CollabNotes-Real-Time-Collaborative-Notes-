import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Index, JoinColumn } from 'typeorm';
import { Workspace } from './workspace.entity';
import { User } from './user.entity';

export enum ActivityEventType {
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  NOTE_UPDATED = 'note_updated',
}

@Entity()
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ActivityEventType,
  })
  eventType: ActivityEventType;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @Index('idx_activity_log_workspace_id')
  @ManyToOne(() => Workspace, (workspace) => workspace.activityLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @ManyToOne(() => User, (user) => user.activityLogs, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User | null;
}
