/**
 * Change Type for Task History
 *
 * Represents the type of change captured in the audit trail.
 */
export enum ChangeType {
  /**
   * Task was created
   */
  CREATE = 'CREATE',

  /**
   * Task field was updated
   */
  UPDATE = 'UPDATE',

  /**
   * Task was soft-deleted
   */
  DELETE = 'DELETE',

  /**
   * Task workflow state was transitioned
   */
  TRANSITION = 'TRANSITION',
}
