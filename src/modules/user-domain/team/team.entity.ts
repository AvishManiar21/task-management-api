import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { User } from '../user/user.entity';

/**
 * Team Entity
 *
 * Represents an organizational team in the Task Management system.
 *
 * Business Rules:
 * - Team names must be unique (BR-TEAM-002)
 * - Users can belong to at most one team (BR-TEAM-001)
 * - Soft delete preserves historical team associations
 * - Team deletion sets members' teamId to NULL (BR-TEAM-005)
 *
 * Related Entities:
 * - User (one-to-many): Team has multiple members
 *
 * @see US-046 (Assign User to Team)
 */
@Entity('teams')
@Index(['name'], { unique: true, where: 'deleted_at IS NULL' })
export class Team {
  /**
   * Primary key (UUID)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Team name (unique)
   * Must be unique across non-deleted teams
   */
  @Column({ type: 'varchar', length: 100, nullable: false })
  @Index({ unique: true, where: 'deleted_at IS NULL' })
  name: string;

  /**
   * Team description
   */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * User who created the team
   */
  @Column({ type: 'uuid', nullable: false, name: 'created_by' })
  createdBy: string;

  /**
   * Record creation timestamp
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /**
   * Last update timestamp
   */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /**
   * Soft delete timestamp
   */
  @DeleteDateColumn({ name: 'deleted_at' })
  @Exclude()
  deletedAt: Date | null;

  /**
   * Team members relationship
   */
  @OneToMany(() => User, (user) => user.team)
  members: User[];
}
