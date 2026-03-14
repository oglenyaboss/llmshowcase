import { test, expect } from '@playwright/test'

test('@shell - renders all required sections', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId('hero-heading')).toBeVisible()

  await expect(page.getByTestId('model-card-qwen-0_8b')).toBeVisible()
  await expect(page.getByTestId('model-card-qwen-2b')).toBeVisible()
  await expect(page.getByTestId('model-card-qwen-4b')).toBeVisible()

  await expect(page.getByTestId('status-webgpu')).toBeVisible()

  await expect(page.getByTestId('prompt-input')).toBeVisible()
  await expect(page.getByTestId('generate-button')).toBeVisible()

  await expect(page.getByTestId('output-stream')).toBeVisible()

  await expect(page.getByTestId('telemetry-panel')).toBeVisible()

  await expect(page.getByTestId('footer-local-inference')).toBeVisible()
})

test('@model-selection - allows switching between models', async ({ page }) => {
  await page.goto('/')

  const modelCard08b = page.getByTestId('model-card-qwen-0_8b')
  const modelCard2b = page.getByTestId('model-card-qwen-2b')
  const modelCard4b = page.getByTestId('model-card-qwen-4b')

  await expect(modelCard08b).toBeVisible()
  await expect(modelCard2b).toBeVisible()
  await expect(modelCard4b).toBeVisible()

  await modelCard2b.click()
  await expect(modelCard2b).toHaveClass(/ring-1/)

  await modelCard4b.click()
  await expect(modelCard4b).toHaveClass(/ring-1/)

  const experimentalWarning = page.locator('text=Qwen 3.5 4B is experimental in-browser')
  await expect(experimentalWarning).toBeVisible()

  await modelCard08b.click()
  await expect(modelCard08b).toHaveClass(/ring-1/)
  await expect(experimentalWarning).not.toBeVisible()
})

test('@unsupported - capability status card renders with correct structure', async ({ page }) => {
  await page.goto('/')

  // Verify status card elements exist with correct structure
  const webgpuStatus = page.getByTestId('status-webgpu')
  await expect(webgpuStatus).toBeVisible()
  await expect(webgpuStatus).toContainText('WebGPU')

  const runtimeStatus = page.getByTestId('status-runtime')
  await expect(runtimeStatus).toBeVisible()
  await expect(runtimeStatus).toContainText('Runtime')

  const modelStatus = page.getByTestId('status-model')
  await expect(modelStatus).toBeVisible()
  await expect(modelStatus).toContainText('Model')

  const warmStatus = page.getByTestId('status-warm')
  await expect(warmStatus).toBeVisible()
  await expect(warmStatus).toContainText('Cache')
})

test('@prompt-controls - inference panel and preset prompts work correctly', async ({ page }) => {
  await page.goto('/')

  const promptInput = page.getByTestId('prompt-input')
  const generateButton = page.getByTestId('generate-button')
  const stopButton = page.getByTestId('stop-button')

  await expect(promptInput).toBeVisible()
  await expect(generateButton).toBeVisible()
  await expect(generateButton).toBeDisabled()

  await promptInput.fill('Test prompt')
  await expect(generateButton).toBeEnabled()

  const presetSummarize = page.getByTestId('preset-summarize')
  const presetExplainCode = page.getByTestId('preset-explain-code')
  const presetRewriteText = page.getByTestId('preset-rewrite-text')
  const presetExtractJson = page.getByTestId('preset-extract-json')

  await expect(presetSummarize).toBeVisible()
  await expect(presetExplainCode).toBeVisible()
  await expect(presetRewriteText).toBeVisible()
  await expect(presetExtractJson).toBeVisible()

  await presetSummarize.click()
  await expect(promptInput).toContainText('Summarize the following in 3 concise bullet points:')

  await promptInput.fill('')
  await presetExplainCode.click()
  await expect(promptInput).toContainText('Explain this code clearly')

  await promptInput.fill('Some existing text')
  await presetRewriteText.click()
  const rewriteText = await promptInput.inputValue()
  expect(rewriteText).toContain('Some existing text')
  expect(rewriteText).toContain('Rewrite the following text')

  await promptInput.fill('')
  await presetExtractJson.click()
  await expect(promptInput).toContainText('Extract structured data')
})

test('@telemetry-shell - displays all required telemetry fields', async ({ page }) => {
  await page.goto('/')

  const telemetryPanel = page.getByTestId('telemetry-panel')
  await expect(telemetryPanel).toBeVisible()

  const telemetryRuntime = page.getByTestId('telemetry-runtime')
  await expect(telemetryRuntime).toBeVisible()

  await expect(telemetryPanel).toContainText('Model')
  await expect(telemetryPanel).toContainText('Label')
  await expect(telemetryPanel).toContainText('Repository')
  await expect(telemetryPanel).toContainText('Support Tier')

  await expect(telemetryPanel).toContainText('Runtime')
  await expect(telemetryPanel).toContainText('Library')
  await expect(telemetryPanel).toContainText('Backend')
  await expect(telemetryPanel).toContainText('Phase')
  await expect(telemetryPanel).toContainText('Warm State')

  await expect(telemetryPanel).toContainText('Capabilities')
  await expect(telemetryPanel).toContainText('shader-f16')
  await expect(telemetryPanel).toContainText('Max Buffer')
  await expect(telemetryPanel).toContainText('Max Storage Buffer')

  await expect(telemetryPanel).toContainText('Performance')
  await expect(telemetryPanel).toContainText('Load Duration')
  await expect(telemetryPanel).toContainText('Warmup Duration')
  await expect(telemetryPanel).toContainText('Generation Duration')
  await expect(telemetryPanel).toContainText('Token Count')
  await expect(telemetryPanel).toContainText('Tokens/sec')

  await expect(telemetryPanel).toContainText('Memory')
})
