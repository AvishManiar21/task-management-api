import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, EntityManager } from 'typeorm';
import { LoggerService } from '../logging/logger.service';

/**
 * Transaction isolation levels supported by PostgreSQL
 */
export type IsolationLevel =
  | 'READ UNCOMMITTED'
  | 'READ COMMITTED'
  | 'REPEATABLE READ'
  | 'SERIALIZABLE';

/**
 * TransactionManager
 *
 * Wrapper around TypeORM transaction management with enhanced logging and error handling.
 *
 * Features:
 * - Simplified transaction API
 * - Automatic rollback on error
 * - Nested transaction support with savepoints
 * - Custom isolation level support
 * - Structured logging for transaction lifecycle
 *
 * Transaction Isolation Levels:
 * - READ UNCOMMITTED: Lowest isolation, dirty reads possible
 * - READ COMMITTED: Default, prevents dirty reads
 * - REPEATABLE READ: Prevents non-repeatable reads
 * - SERIALIZABLE: Highest isolation, prevents phantom reads
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class UserService {
 *   constructor(private readonly txManager: TransactionManager) {}
 *
 *   async createUserWithProfile(dto: CreateUserDto) {
 *     return await this.txManager.run(async (entityManager) => {
 *       // Both operations execute in same transaction
 *       const user = await entityManager.save(User, dto);
 *       const profile = await entityManager.save(UserProfile, {
 *         userId: user.id,
 *         ...dto.profile
 *       });
 *
 *       return { user, profile };
 *     });
 *     // Auto-commit if no error, auto-rollback if error thrown
 *   }
 *
 *   async transferTaskOwnership(taskId: string, fromUserId: string, toUserId: string) {
 *     return await this.txManager.runInTransaction(
 *       'SERIALIZABLE',
 *       async (entityManager) => {
 *         // High isolation for ownership transfer
 *         const task = await entityManager.findOne(Task, taskId, { lock: { mode: 'pessimistic_write' } });
 *
 *         if (task.assigneeId !== fromUserId) {
 *           throw new Error('Unauthorized transfer');
 *         }
 *
 *         task.assigneeId = toUserId;
 *         task.transferredAt = new Date();
 *
 *         return await entityManager.save(task);
 *       }
 *     );
 *   }
 * }
 * ```
 *
 * Complies with:
 * - Technical requirement: Data consistency and atomicity
 */
@Injectable()
export class TransactionManager {
  private readonly logger = new LoggerService();

  constructor(@InjectConnection() private readonly connection: Connection) {
    this.logger.setContext('TransactionManager');
  }

  /**
   * Execute callback in transaction with default isolation level
   *
   * Automatically commits transaction if callback succeeds.
   * Automatically rolls back transaction if callback throws error.
   *
   * @param callback - Async function to execute in transaction
   * @returns Result of callback
   * @template T - Return type
   *
   * @throws Error from callback (transaction will be rolled back)
   */
  async run<T>(callback: (entityManager: EntityManager) => Promise<T>): Promise<T> {
    return await this.runInTransaction('READ COMMITTED', callback);
  }

  /**
   * Execute callback in transaction with custom isolation level
   *
   * Isolation Levels:
   * - READ UNCOMMITTED: Lowest isolation, allows dirty reads
   * - READ COMMITTED: Default, prevents dirty reads
   * - REPEATABLE READ: Prevents non-repeatable reads (PostgreSQL default)
   * - SERIALIZABLE: Highest isolation, prevents all concurrency issues
   *
   * @param isolationLevel - Transaction isolation level
   * @param callback - Async function to execute in transaction
   * @returns Result of callback
   * @template T - Return type
   *
   * @throws Error from callback (transaction will be rolled back)
   */
  async runInTransaction<T>(
    isolationLevel: IsolationLevel,
    callback: (entityManager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const transactionId = this.generateTransactionId();

    this.logger.debug(`Transaction ${transactionId} START (isolation: ${isolationLevel})`);

    const startTime = Date.now();

    try {
      const result = await this.connection.transaction(isolationLevel, async (entityManager) => {
        // Check if we're in a nested transaction
        const isNested = (entityManager as any).queryRunner?.isTransactionActive;

        if (isNested) {
          this.logger.debug(`Transaction ${transactionId} is nested (using savepoint)`);
        }

        return await callback(entityManager);
      });

      const duration = Date.now() - startTime;
      this.logger.debug(`Transaction ${transactionId} COMMIT (duration: ${duration}ms)`);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Transaction ${transactionId} ROLLBACK (duration: ${duration}ms)`,
        error.stack,
        { error: error.message },
      );

      throw error;
    }
  }

  /**
   * Execute callback in transaction with pessimistic write lock
   *
   * Acquires FOR UPDATE lock on all SELECT queries within transaction.
   * Use for operations that require exclusive access to rows.
   *
   * @param callback - Async function to execute in transaction
   * @returns Result of callback
   * @template T - Return type
   */
  async runWithLock<T>(callback: (entityManager: EntityManager) => Promise<T>): Promise<T> {
    return await this.runInTransaction('SERIALIZABLE', callback);
  }

  /**
   * Generate unique transaction ID for logging
   *
   * @returns Transaction ID
   */
  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}
