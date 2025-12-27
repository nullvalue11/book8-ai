/**
 * Ops Tool Registry
 * 
 * Central registry for all ops tools with schema validation and execution.
 * Tools are allowlisted and validated before execution.
 */

import { z } from 'zod'

// Tool registry - all tools must be registered here
const tools = new Map()

/**
 * Register a tool in the registry
 * @param {string} name - Tool name (e.g., 'tenant.ensure')
 * @param {object} config - Tool configuration
 */
export function registerTool(name, config) {
  if (tools.has(name)) {
    throw new Error(`Tool '${name}' is already registered`)
  }
  
  const { schema, execute, description, requiredRole = 'ops' } = config
  
  if (!schema || !(schema instanceof z.ZodType)) {
    throw new Error(`Tool '${name}' must have a valid Zod schema`)
  }
  
  if (typeof execute !== 'function') {
    throw new Error(`Tool '${name}' must have an execute function`)
  }
  
  tools.set(name, {
    name,
    schema,
    execute,
    description: description || '',
    requiredRole
  })
}

/**
 * Get a tool by name
 * @param {string} name - Tool name
 * @returns {object|null} Tool configuration or null if not found
 */
export function getTool(name) {
  return tools.get(name) || null
}

/**
 * Check if a tool exists in the allowlist
 * @param {string} name - Tool name
 * @returns {boolean}
 */
export function isToolAllowed(name) {
  return tools.has(name)
}

/**
 * Get all registered tool names
 * @returns {string[]}
 */
export function getToolNames() {
  return Array.from(tools.keys())
}

/**
 * Validate tool arguments against schema
 * @param {string} toolName - Tool name
 * @param {object} args - Arguments to validate
 * @returns {{ valid: boolean, data?: object, errors?: object[] }}
 */
export function validateToolArgs(toolName, args) {
  const tool = getTool(toolName)
  if (!tool) {
    return { valid: false, errors: [{ message: `Tool '${toolName}' not found` }] }
  }
  
  try {
    const data = tool.schema.parse(args)
    return { valid: true, data }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        valid: false, 
        errors: error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
          code: e.code
        }))
      }
    }
    return { valid: false, errors: [{ message: error.message }] }
  }
}

/**
 * Execute a tool
 * @param {string} toolName - Tool name
 * @param {object} args - Validated arguments
 * @param {object} ctx - Execution context (dryRun, requestId, actor, db, etc.)
 * @returns {Promise<object>} Tool result
 */
export async function executeTool(toolName, args, ctx) {
  const tool = getTool(toolName)
  if (!tool) {
    throw new Error(`Tool '${toolName}' not found`)
  }
  
  return tool.execute(args, ctx)
}
