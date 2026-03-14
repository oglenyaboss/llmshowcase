/**
 * Preset Prompts
 * Fixed prompt templates for common use cases
 */

export interface PresetConfig {
  id: string
  label: string
  template: string
}

/**
 * Summarize preset - creates 3 concise bullet points
 */
const summarize: PresetConfig = {
  id: 'summarize',
  label: 'Summarize',
  template: 'Summarize the following in 3 concise bullet points:\n\n{{input}}',
}

/**
 * Explain code preset - describes code functionality and risks
 */
const explainCode: PresetConfig = {
  id: 'explain-code',
  label: 'Explain code',
  template:
    'Explain this code clearly. Describe what it does, how it works, and any obvious risks or edge cases:\n\n{{input}}',
}

/**
 * Rewrite text preset - improves clarity and professionalism
 */
const rewriteText: PresetConfig = {
  id: 'rewrite-text',
  label: 'Rewrite text',
  template:
    'Rewrite the following text to be clearer, tighter, and more professional while preserving the meaning:\n\n{{input}}',
}

/**
 * Extract JSON preset - extracts structured data as JSON
 */
const extractJson: PresetConfig = {
  id: 'extract-json',
  label: 'Extract JSON',
  template:
    'Extract structured data from the following text. Return valid minified JSON only with keys: summary, entities, action_items.\n\n{{input}}',
}

/**
 * All preset configurations indexed by ID
 */
export const presets: Record<string, PresetConfig> = {
  summarize,
  'explain-code': explainCode,
  'rewrite-text': rewriteText,
  'extract-json': extractJson,
}

/**
 * Ordered list of preset configurations
 */
export const presetList: PresetConfig[] = [
  summarize,
  explainCode,
  rewriteText,
  extractJson,
]

/**
 * Get a preset configuration by ID
 */
export function getPresetById(id: string): PresetConfig | undefined {
  return presets[id]
}

/**
 * Apply a preset template to input text
 * - If input is provided, replaces {{input}} placeholder with the input
 * - If input is empty, returns template without the placeholder
 */
export function applyPresetTemplate(
  template: string,
  input: string
): string {
  if (input.trim()) {
    return template.replace('{{input}}', input)
  }
  return template.replace('\n\n{{input}}', '').replace('{{input}}', '')
}

/**
 * Get default preset ID
 */
export function getDefaultPresetId(): string {
  return 'summarize'
}