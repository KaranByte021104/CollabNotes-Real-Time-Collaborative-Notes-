import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToOne, OneToMany, Index } from 'typeorm';
import { User } from './user.entity';
import { Note } from './note.entity';
import { WorkspaceParticipant } from './workspace-participant.entity';
import { ActivityLog } from './activity-log.entity';

@Entity()
export class Workspace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Index({ unique: true })
  @Column({ unique: true })
  code: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.ownedWorkspaces, { onDelete: 'CASCADE' })
  createdBy: User;

  @OneToOne(() => Note, (note) => note.workspace, { cascade: true })
  note: Note;

  @OneToMany(() => WorkspaceParticipant, (participant) => participant.workspace)
  participants: WorkspaceParticipant[];

  @OneToMany(() => ActivityLog, (log) => log.workspace)
  activityLogs: ActivityLog[];
}
