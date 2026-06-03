import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Workspace } from './workspace.entity';
import { WorkspaceParticipant } from './workspace-participant.entity';
import { ActivityLog } from './activity-log.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password?: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @OneToMany(() => Workspace, (workspace) => workspace.createdBy)
  ownedWorkspaces: Workspace[];

  @OneToMany(() => WorkspaceParticipant, (participant) => participant.user)
  workspaceParticipants: WorkspaceParticipant[];

  @OneToMany(() => ActivityLog, (log) => log.user)
  activityLogs: ActivityLog[];
}
