/**
 * Runtime Factory
 * Returns real ModelManager or MockModelManager based on environment
 */

import { ModelManager, type ModelManagerCallbacks } from './model-manager'
import { MockModelManager } from './mock-model-manager'

export type { ModelManagerCallbacks }

/**
 * Create a ModelManager instance
 * Returns MockModelManager when NEXT_PUBLIC_E2E_MOCK_RUNTIME=1 for E2E testing
 */
export function createModelManager(callbacks: ModelManagerCallbacks): ModelManager | MockModelManager {
  if (process.env.NEXT_PUBLIC_E2E_MOCK_RUNTIME === '1') {
    return new MockModelManager(callbacks)
  }
  return new ModelManager(callbacks)
}