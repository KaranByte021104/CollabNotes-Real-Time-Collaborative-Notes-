import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, CreateDateColumn, ManyToOne, JoinColumn, ManyToMany, JoinTable } from 'typeorm';
import { Workspace } from './workspace.entity';
import { User } from './user.entity';
import { Tag } from './tag.entity';

@Entity()
export class Note {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', default: 'Untitled Note' })
  title: string;

  @Column({ type: 'integer', default: 0 })
  order: number;

  @Column({
    type: 'text',
    default: '{"type":"doc","content":[{"type":"paragraph"}]}',
  })
  content: string;

  @Column({ type: 'bytea', nullable: true })
  ydocState: Buffer | null;

  @Column({ type: 'boolean', default: false })
  isLocked: boolean;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'lockedById' })
  lockedBy: User | null;

  @Column({ nullable: true })
  lockedById: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lockedAt: Date | null;

  @Column({ type: 'boolean', default: false })
  isPinned: boolean;

  @Column({ type: 'timestamp', nullable: true })
  pinnedAt: Date | null;

  @ManyToMany(() => Tag, (tag) => tag.notes, { cascade: true })
  @JoinTable({ name: 'note_tags' })
  tags: Tag[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => Workspace, (workspace) => workspace.notes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column()
  workspaceId: string;
}
