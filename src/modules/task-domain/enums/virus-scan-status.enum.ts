/**
 * Virus Scan Status
 *
 * Represents the current status of virus scanning for an attachment.
 * All uploaded files must be scanned before being made available for download.
 */
export enum VirusScanStatus {
  /**
   * Scan is pending - file uploaded but not yet scanned
   */
  PENDING = 'PENDING',

  /**
   * Scan completed - no threats detected, file is safe
   */
  CLEAN = 'CLEAN',

  /**
   * Scan completed - threats detected, file is quarantined
   */
  INFECTED = 'INFECTED',
}
