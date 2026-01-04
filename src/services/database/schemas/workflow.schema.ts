import type { RxJsonSchema } from 'rxdb'

/**
 * Workflow node types for visual workflow engine
 */
export type WorkflowNodeType =
  | 'trigger' // Entry point for workflow (email received, attribute changed, etc.)
  | 'condition' // Boolean logic node
  | 'action' // Perform action (apply attribute, archive, label, etc.)
  | 'decision' // AI-enhanced decision node
  | 'variable' // Store/retrieve workflow variables
  | 'screen-flow' // Multi-step user interaction

/**
 * Workflow node representing a single step in the workflow
 */
export interface WorkflowNode {
  id: string // Unique node identifier
  type: WorkflowNodeType // Node type
  position: {
    x: number // X coordinate on canvas
    y: number // Y coordinate on canvas
  }
  data: Record<string, unknown> // Node-specific data (flexible structure)
}

/**
 * Workflow edge representing connection between nodes
 */
export interface WorkflowEdge {
  id: string // Unique edge identifier
  source: string // Source node ID
  target: string // Target node ID
  sourceHandle?: string // Optional source handle ID
  targetHandle?: string // Optional target handle ID
}

/**
 * Workflow trigger configuration
 */
export interface WorkflowTrigger {
  type: string // Trigger type (email_received, attribute_changed, schedule, manual)
  config: Record<string, unknown> // Trigger-specific configuration
}

/**
 * Workflow document type representing an automated workflow
 * Supports visual workflow editor with nodes and edges
 */
export interface WorkflowDocument {
  id: string // Primary key - workflow identifier
  name: string // Workflow name
  description: string // Workflow description
  enabled: boolean // Workflow enabled/disabled
  createdAt: number // Unix timestamp
  updatedAt: number // Unix timestamp
  nodes: WorkflowNode[] // Workflow nodes (triggers, conditions, actions, decisions, variables)
  edges: WorkflowEdge[] // Workflow edges (connections between nodes)
  triggers: WorkflowTrigger[] // Workflow trigger configurations
  lastExecutedAt?: number // Unix timestamp (optional)
  executionCount: number // Number of times workflow executed
}

/**
 * RxDB schema for Workflow collection
 * Version 0 - Initial schema design
 *
 * Indexes:
 * - enabled: For querying active workflows
 *
 * Note: Array fields like triggers cannot be directly indexed in RxDB.
 * Use application-level filtering for trigger matching.
 */
export const workflowSchema: RxJsonSchema<WorkflowDocument> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100,
    },
    name: {
      type: 'string',
      maxLength: 200,
    },
    description: {
      type: 'string',
      maxLength: 1000,
    },
    enabled: {
      type: 'boolean',
    },
    createdAt: {
      type: 'number',
      minimum: 0,
      multipleOf: 1,
    },
    updatedAt: {
      type: 'number',
      minimum: 0,
      multipleOf: 1,
    },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            maxLength: 100,
          },
          type: {
            type: 'string',
            enum: ['trigger', 'condition', 'action', 'decision', 'variable', 'screen-flow'],
          },
          position: {
            type: 'object',
            properties: {
              x: {
                type: 'number',
              },
              y: {
                type: 'number',
              },
            },
            required: ['x', 'y'],
          },
          data: {
            type: 'object',
            additionalProperties: true, // Flexible node-specific data
          },
        },
        required: ['id', 'type', 'position', 'data'],
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            maxLength: 100,
          },
          source: {
            type: 'string',
            maxLength: 100,
          },
          target: {
            type: 'string',
            maxLength: 100,
          },
          sourceHandle: {
            type: 'string',
            maxLength: 100,
          },
          targetHandle: {
            type: 'string',
            maxLength: 100,
          },
        },
        required: ['id', 'source', 'target'],
      },
    },
    triggers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            maxLength: 100,
          },
          config: {
            type: 'object',
            additionalProperties: true, // Flexible trigger configuration
          },
        },
        required: ['type', 'config'],
      },
    },
    lastExecutedAt: {
      type: 'number',
      minimum: 0,
      multipleOf: 1,
    },
    executionCount: {
      type: 'number',
      minimum: 0,
      multipleOf: 1,
    },
  },
  required: [
    'id',
    'name',
    'description',
    'enabled',
    'createdAt',
    'updatedAt',
    'nodes',
    'edges',
    'triggers',
    'executionCount',
  ],
  indexes: [
    'enabled', // Query active workflows
  ],
}
