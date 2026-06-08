import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';
import { Note } from './note.entity';
import { ActivityEventType } from './activity-log.entity';

@Entity()
@Index(['userId', 'isRead'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Workspace, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace | null;

  @Column({ nullable: true })
  workspaceId: string | null;

  @ManyToOne(() => Note, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'noteId' })
  note: Note | null;

  @Column({ nullable: true })
  noteId: string | null;

  @Column({
    type: 'enum',
    enum: ActivityEventType,
  })
  eventType: ActivityEventType;

  @Column({ type: 'varchar' })
  message: string;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
