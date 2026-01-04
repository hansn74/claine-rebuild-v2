import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRxDatabase, addRxPlugin, type RxDatabase } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv'
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode'
import { workflowSchema, type WorkflowDocument } from '../workflow.schema'

addRxPlugin(RxDBDevModePlugin)

describe('Workflow Schema', () => {
  let db: RxDatabase

  beforeEach(async () => {
    db = await createRxDatabase({
      name: `test-workflow-schema-${Date.now()}`,
      storage: wrappedValidateAjvStorage({ storage: getRxStorageDexie() }),
      multiInstance: false,
      ignoreDuplicate: true,
    })

    await db.addCollections({
      workflows: {
        schema: workflowSchema,
      },
    })
  })

  afterEach(async () => {
    if (db) {
      await db.remove()
    }
  })

  describe('Required Fields', () => {
    it('should validate required fields are present', async () => {
      const now = Date.now()
      const validWorkflow: WorkflowDocument = {
        id: 'test-workflow-1',
        name: 'Auto-Archive Old Emails',
        description: 'Automatically archive emails older than 30 days',
        enabled: true,
        createdAt: now,
        updatedAt: now,
        nodes: [
          {
            id: 'node-1',
            type: 'trigger',
            position: { x: 100, y: 100 },
            data: { triggerType: 'email_received' },
          },
        ],
        edges: [],
        triggers: [
          {
            type: 'email_received',
            config: { filter: 'all' },
          },
        ],
        executionCount: 0,
      }

      const doc = await db.workflows.insert(validWorkflow)
      expect(doc.id).toBe('test-workflow-1')
      expect(doc.name).toBe('Auto-Archive Old Emails')
    })

    it('should reject workflow missing required field (name)', async () => {
      const invalidWorkflow = {
        id: 'test-workflow-2',
        // Missing 'name'
        description: 'Test',
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        nodes: [],
        edges: [],
        triggers: [],
        executionCount: 0,
      }

      await expect(db.workflows.insert(invalidWorkflow)).rejects.toThrow()
    })
  })

  describe('Complex Nested Structures', () => {
    it('should validate nodes array with objects', async () => {
      const now = Date.now()
      const workflow: WorkflowDocument = {
        id: 'test-workflow-3',
        name: 'Complex Workflow',
        description: 'Multi-step workflow with various node types',
        enabled: true,
        createdAt: now,
        updatedAt: now,
        nodes: [
          {
            id: 'trigger-node',
            type: 'trigger',
            position: { x: 100, y: 100 },
            data: { triggerType: 'email_received' },
          },
          {
            id: 'condition-node',
            type: 'condition',
            position: { x: 300, y: 100 },
            data: { condition: 'has_label', value: 'important' },
          },
          {
            id: 'action-node',
            type: 'action',
            position: { x: 500, y: 100 },
            data: { actionType: 'apply_attribute', attribute: 'Priority', value: 'High' },
          },
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'trigger-node',
            target: 'condition-node',
          },
          {
            id: 'edge-2',
            source: 'condition-node',
            target: 'action-node',
            sourceHandle: 'true-output',
            targetHandle: 'input',
          },
        ],
        triggers: [
          {
            type: 'email_received',
            config: { filter: 'all' },
          },
        ],
        executionCount: 0,
      }

      const doc = await db.workflows.insert(workflow)
      expect(doc.nodes.length).toBe(3)
      expect(doc.edges.length).toBe(2)
      expect(doc.nodes[1].type).toBe('condition')
    })

    it('should validate all node types', async () => {
      const now = Date.now()
      const workflow: WorkflowDocument = {
        id: 'test-workflow-4',
        name: 'All Node Types',
        description: 'Test all supported node types',
        enabled: true,
        createdAt: now,
        updatedAt: now,
        nodes: [
          { id: 'n1', type: 'trigger', position: { x: 0, y: 0 }, data: {} },
          { id: 'n2', type: 'condition', position: { x: 100, y: 0 }, data: {} },
          { id: 'n3', type: 'action', position: { x: 200, y: 0 }, data: {} },
          { id: 'n4', type: 'decision', position: { x: 300, y: 0 }, data: {} },
          { id: 'n5', type: 'variable', position: { x: 400, y: 0 }, data: {} },
          { id: 'n6', type: 'screen-flow', position: { x: 500, y: 0 }, data: {} },
        ],
        edges: [],
        triggers: [],
        executionCount: 0,
      }

      const doc = await db.workflows.insert(workflow)
      expect(doc.nodes.length).toBe(6)
    })

    it('should reject invalid node type', async () => {
      const now = Date.now()
      const invalidWorkflow = {
        id: 'test-workflow-5',
        name: 'Invalid Node Type',
        description: 'Test',
        enabled: true,
        createdAt: now,
        updatedAt: now,
        nodes: [
          {
            id: 'node-1',
            type: 'invalid-type', // Not in enum
            position: { x: 0, y: 0 },
            data: {},
          },
        ],
        edges: [],
        triggers: [],
        executionCount: 0,
      }

      await expect(db.workflows.insert(invalidWorkflow)).rejects.toThrow()
    })
  })

  describe('Optional Fields', () => {
    it('should accept optional lastExecutedAt field', async () => {
      const now = Date.now()
      const workflow: WorkflowDocument = {
        id: 'test-workflow-6',
        name: 'Executed Workflow',
        description: 'Test',
        enabled: true,
        createdAt: now,
        updatedAt: now,
        nodes: [],
        edges: [],
        triggers: [],
        lastExecutedAt: now - 1000,
        executionCount: 5,
      }

      const doc = await db.workflows.insert(workflow)
      expect(doc.lastExecutedAt).toBe(now - 1000)
      expect(doc.executionCount).toBe(5)
    })
  })

  describe('Indexes', () => {
    it('should have enabled index for active workflow queries', () => {
      const indexes = workflowSchema.indexes || []
      expect(indexes).toContain('enabled')
    })
  })
})
