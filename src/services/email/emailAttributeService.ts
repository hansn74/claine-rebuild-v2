/**
 * Email Attribute Service
 *
 * Story 2.14: Apply Attributes to Emails - UI & Interaction
 * Task 2: Create Email Attribute Service
 *
 * Manages attribute assignment to emails in RxDB.
 * Provides CRUD operations for email attributes with optimistic updates.
 *
 * AC 2: User can select/apply multiple attributes to a single email
 * AC 7: Attribute changes saved immediately to RxDB
 * AC 10: User can remove attributes
 */

import { Subject, Observable } from 'rxjs'
import { getDatabase } from '@/services/database/init'
import { logger } from '@/services/logger'
import { attributeService } from '@/services/attributes/attributeService'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import type { AttributeValue, EmailAttributeValues } from '@/types/attributes'

/**
 * Event types emitted by the email attribute service
 */
export type EmailAttributeEvent =
  | { type: 'attribute-set'; emailId: string; attributeId: string; value: AttributeValue }
  | { type: 'attribute-removed'; emailId: string; attributeId: string }
  | { type: 'attributes-set'; emailId: string; attributes: EmailAttributeValues }
  | { type: 'attribute-error'; emailId: string; error: string }

/**
 * Result of an email attribute operation
 */
export interface EmailAttributeResult {
  success: boolean
  emailId: string
  attributes: EmailAttributeValues
  error?: string
  previousAttributes?: EmailAttributeValues
}

/**
 * Email Attribute Service
 *
 * Singleton service that manages email attribute assignments.
 * Provides methods for setting, getting, and removing attributes on emails.
 *
 * Usage:
 * ```typescript
 * import { emailAttributeService } from '@/services/email/emailAttributeService'
 *
 * // Set a single attribute
 * await emailAttributeService.setEmailAttribute(emailId, 'priority', 'high')
 *
 * // Set multiple attributes
 * await emailAttributeService.setEmailAttributes(emailId, {
 *   priority: 'high',
 *   status: 'in-progress',
 *   dueDate: '2025-12-31'
 * })
 *
 * // Remove an attribute
 * await emailAttributeService.removeEmailAttribute(emailId, 'priority')
 *
 * // Get all attributes for an email
 * const attrs = await emailAttributeService.getEmailAttributes(emailId)
 * ```
 */
export class EmailAttributeService {
  private static instance: EmailAttributeService
  private events$ = new Subject<EmailAttributeEvent>()

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): EmailAttributeService {
    if (!EmailAttributeService.instance) {
      EmailAttributeService.instance = new EmailAttributeService()
    }
    return EmailAttributeService.instance
  }

  /**
   * Get observable for attribute events
   * Used by UI components to react to attribute changes
   */
  getEvents$(): Observable<EmailAttributeEvent> {
    return this.events$.asObservable()
  }

  /**
   * Set a single attribute on an email
   * AC 7: Attribute changes saved immediately to RxDB
   *
   * @param emailId - Email ID to set attribute on
   * @param attributeId - Attribute ID (or name) to set
   * @param value - Value to assign
   * @returns Result with updated attributes
   */
  async setEmailAttribute(
    emailId: string,
    attributeId: string,
    value: AttributeValue
  ): Promise<EmailAttributeResult> {
    const db = getDatabase()
    const emailDoc = await db.emails?.findOne(emailId).exec()

    if (!emailDoc) {
      const error = `Email not found: ${emailId}`
      this.events$.next({ type: 'attribute-error', emailId, error })
      return { success: false, emailId, attributes: {}, error }
    }

    const email = emailDoc.toJSON() as EmailDocument
    const previousAttributes = { ...email.attributes }

    // Validate attribute exists if we're validating (optional - might be attribute ID)
    const attribute = await attributeService.getAttributeById(attributeId)
    if (!attribute) {
      // Try finding by name as fallback
      const byName = await attributeService.findByName(attributeId)
      if (byName) {
        // Use the ID instead
        attributeId = byName.id
      } else {
        logger.warn('email-attributes', 'Attribute not found, setting anyway', { attributeId })
      }
    }

    try {
      // Merge with existing attributes
      const newAttributes: EmailAttributeValues = {
        ...email.attributes,
        [attributeId]: value,
      }

      await emailDoc.update({
        $set: { attributes: newAttributes },
      })

      logger.info('email-attributes', 'Attribute set on email', {
        emailId,
        attributeId,
        value,
      })

      this.events$.next({ type: 'attribute-set', emailId, attributeId, value })

      return {
        success: true,
        emailId,
        attributes: newAttributes,
        previousAttributes,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('email-attributes', 'Failed to set attribute', {
        emailId,
        attributeId,
        error: errorMessage,
      })
      this.events$.next({ type: 'attribute-error', emailId, error: errorMessage })
      return { success: false, emailId, attributes: email.attributes, error: errorMessage }
    }
  }

  /**
   * Set multiple attributes on an email at once
   * AC 2: User can select/apply multiple attributes to a single email
   *
   * @param emailId - Email ID to set attributes on
   * @param attributes - Object of attribute ID/name to value mappings
   * @returns Result with updated attributes
   */
  async setEmailAttributes(
    emailId: string,
    attributes: EmailAttributeValues
  ): Promise<EmailAttributeResult> {
    const db = getDatabase()
    const emailDoc = await db.emails?.findOne(emailId).exec()

    if (!emailDoc) {
      const error = `Email not found: ${emailId}`
      this.events$.next({ type: 'attribute-error', emailId, error })
      return { success: false, emailId, attributes: {}, error }
    }

    const email = emailDoc.toJSON() as EmailDocument
    const previousAttributes = { ...email.attributes }

    try {
      // Merge with existing attributes
      const newAttributes: EmailAttributeValues = {
        ...email.attributes,
        ...attributes,
      }

      await emailDoc.update({
        $set: { attributes: newAttributes },
      })

      logger.info('email-attributes', 'Multiple attributes set on email', {
        emailId,
        attributeCount: Object.keys(attributes).length,
      })

      this.events$.next({ type: 'attributes-set', emailId, attributes: newAttributes })

      return {
        success: true,
        emailId,
        attributes: newAttributes,
        previousAttributes,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('email-attributes', 'Failed to set multiple attributes', {
        emailId,
        error: errorMessage,
      })
      this.events$.next({ type: 'attribute-error', emailId, error: errorMessage })
      return { success: false, emailId, attributes: email.attributes, error: errorMessage }
    }
  }

  /**
   * Remove an attribute from an email
   * AC 10: User can remove attributes
   *
   * @param emailId - Email ID to remove attribute from
   * @param attributeId - Attribute ID to remove
   * @returns Result with updated attributes
   */
  async removeEmailAttribute(emailId: string, attributeId: string): Promise<EmailAttributeResult> {
    const db = getDatabase()
    const emailDoc = await db.emails?.findOne(emailId).exec()

    if (!emailDoc) {
      const error = `Email not found: ${emailId}`
      this.events$.next({ type: 'attribute-error', emailId, error })
      return { success: false, emailId, attributes: {}, error }
    }

    const email = emailDoc.toJSON() as EmailDocument
    const previousAttributes = { ...email.attributes }

    // Check if attribute exists on email
    if (!(attributeId in email.attributes)) {
      logger.debug('email-attributes', 'Attribute not found on email', {
        emailId,
        attributeId,
      })
      return {
        success: true,
        emailId,
        attributes: email.attributes,
        previousAttributes,
      }
    }

    try {
      // Create new attributes object without the removed attribute
      const newAttributes: EmailAttributeValues = { ...email.attributes }
      delete newAttributes[attributeId]

      await emailDoc.update({
        $set: { attributes: newAttributes },
      })

      logger.info('email-attributes', 'Attribute removed from email', {
        emailId,
        attributeId,
      })

      this.events$.next({ type: 'attribute-removed', emailId, attributeId })

      return {
        success: true,
        emailId,
        attributes: newAttributes,
        previousAttributes,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('email-attributes', 'Failed to remove attribute', {
        emailId,
        attributeId,
        error: errorMessage,
      })
      this.events$.next({ type: 'attribute-error', emailId, error: errorMessage })
      return { success: false, emailId, attributes: email.attributes, error: errorMessage }
    }
  }

  /**
   * Get all attributes for an email
   *
   * @param emailId - Email ID to get attributes for
   * @returns Email attributes or empty object if email not found
   */
  async getEmailAttributes(emailId: string): Promise<EmailAttributeValues> {
    const db = getDatabase()
    const emailDoc = await db.emails?.findOne(emailId).exec()

    if (!emailDoc) {
      logger.warn('email-attributes', 'Email not found when getting attributes', { emailId })
      return {}
    }

    const email = emailDoc.toJSON() as EmailDocument
    return email.attributes
  }

  /**
   * Query emails by attribute value
   *
   * @param attributeId - Attribute ID to filter by
   * @param value - Value to match
   * @returns Array of email IDs matching the criteria
   */
  async getEmailsByAttribute(attributeId: string, value: AttributeValue): Promise<string[]> {
    const db = getDatabase()
    const collection = db.emails

    if (!collection) {
      return []
    }

    // RxDB doesn't support querying nested dynamic keys directly,
    // so we need to fetch all and filter in memory
    // For large datasets, consider using a separate index collection
    const allEmails = await collection.find().exec()

    const matchingIds: string[] = []
    for (const doc of allEmails) {
      const email = doc.toJSON() as EmailDocument
      if (email.attributes[attributeId] === value) {
        matchingIds.push(email.id)
      }
    }

    logger.debug('email-attributes', 'Emails queried by attribute', {
      attributeId,
      value,
      matchCount: matchingIds.length,
    })

    return matchingIds
  }

  /**
   * Get emails that have any value for a specific attribute
   *
   * @param attributeId - Attribute ID to check
   * @returns Array of email IDs that have the attribute set
   */
  async getEmailsWithAttribute(attributeId: string): Promise<string[]> {
    const db = getDatabase()
    const collection = db.emails

    if (!collection) {
      return []
    }

    const allEmails = await collection.find().exec()

    const matchingIds: string[] = []
    for (const doc of allEmails) {
      const email = doc.toJSON() as EmailDocument
      if (attributeId in email.attributes && email.attributes[attributeId] !== null) {
        matchingIds.push(email.id)
      }
    }

    return matchingIds
  }

  /**
   * Clear all attributes from an email
   *
   * @param emailId - Email ID to clear attributes from
   * @returns Result with updated (empty) attributes
   */
  async clearEmailAttributes(emailId: string): Promise<EmailAttributeResult> {
    const db = getDatabase()
    const emailDoc = await db.emails?.findOne(emailId).exec()

    if (!emailDoc) {
      const error = `Email not found: ${emailId}`
      this.events$.next({ type: 'attribute-error', emailId, error })
      return { success: false, emailId, attributes: {}, error }
    }

    const email = emailDoc.toJSON() as EmailDocument
    const previousAttributes = { ...email.attributes }

    try {
      await emailDoc.update({
        $set: { attributes: {} },
      })

      logger.info('email-attributes', 'All attributes cleared from email', { emailId })

      this.events$.next({ type: 'attributes-set', emailId, attributes: {} })

      return {
        success: true,
        emailId,
        attributes: {},
        previousAttributes,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('email-attributes', 'Failed to clear attributes', {
        emailId,
        error: errorMessage,
      })
      this.events$.next({ type: 'attribute-error', emailId, error: errorMessage })
      return { success: false, emailId, attributes: email.attributes, error: errorMessage }
    }
  }

  /**
   * Rollback attribute changes using previous state
   * Used for optimistic update rollback
   *
   * @param emailId - Email ID to rollback
   * @param previousAttributes - Previous attributes to restore
   * @returns Result with restored attributes
   */
  async rollbackAttributes(
    emailId: string,
    previousAttributes: EmailAttributeValues
  ): Promise<EmailAttributeResult> {
    const db = getDatabase()
    const emailDoc = await db.emails?.findOne(emailId).exec()

    if (!emailDoc) {
      const error = `Email not found: ${emailId}`
      return { success: false, emailId, attributes: {}, error }
    }

    try {
      await emailDoc.update({
        $set: { attributes: previousAttributes },
      })

      logger.info('email-attributes', 'Attributes rolled back', { emailId })

      this.events$.next({ type: 'attributes-set', emailId, attributes: previousAttributes })

      return {
        success: true,
        emailId,
        attributes: previousAttributes,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('email-attributes', 'Rollback failed', {
        emailId,
        error: errorMessage,
      })
      return { success: false, emailId, attributes: {}, error: errorMessage }
    }
  }

  /**
   * Reset singleton instance (for testing only)
   * @internal
   */
  static __resetForTesting(): void {
    if (EmailAttributeService.instance) {
      EmailAttributeService.instance.events$.complete()
    }
    EmailAttributeService.instance = null as unknown as EmailAttributeService
  }
}

/**
 * Singleton instance export
 */
export const emailAttributeService = EmailAttributeService.getInstance()
