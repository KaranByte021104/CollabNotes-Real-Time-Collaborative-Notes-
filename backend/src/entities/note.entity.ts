import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { Workspace } from './workspace.entity';

@Entity()
export class Note {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'text',
    default: '{"type":"doc","content":[{"type":"paragraph"}]}',
  })
  content: string;

  @Column({ type: 'bytea', nullable: true })
  ydocState: Buffer | null;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @OneToOne(() => Workspace, (workspace) => workspace.note, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;
}
