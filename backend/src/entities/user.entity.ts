import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
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

  @Column({ type: 'varchar', nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'varchar', nullable: true, length: 160 })
  bio: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => Workspace, (workspace) => workspace.createdBy)
  ownedWorkspaces: Workspace[];

  @OneToMany(() => WorkspaceParticipant, (participant) => participant.user)
  workspaceParticipants: WorkspaceParticipant[];

  @OneToMany(() => ActivityLog, (log) => log.user)
  activityLogs: ActivityLog[];
}
