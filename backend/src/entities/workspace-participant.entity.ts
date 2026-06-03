import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Workspace } from './workspace.entity';
import { User } from './user.entity';

@Entity()
@Index('idx_workspace_participant_unique', ['workspaceId', 'userId'], { unique: true })
export class WorkspaceParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamp' })
  joinedAt: Date;

  @Column()
  workspaceId: string;

  @Column()
  userId: string;

  @ManyToOne(() => Workspace, (workspace) => workspace.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @ManyToOne(() => User, (user) => user.workspaceParticipants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
