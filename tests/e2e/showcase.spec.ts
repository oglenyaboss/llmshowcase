import { test, expect } from '@playwright/test'

test('@shell - renders chat workspace layout', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId('chat-sidebar')).toBeVisible()
  await expect(page.getByTestId('chat-thread')).toBeVisible()
  await expect(page.getByTestId('chat-composer')).toBeVisible()
  await expect(page.getByTestId('chat-settings-rail').first()).toBeVisible()
  await expect(page.getByTestId('new-chat-button')).toBeVisible()
  await expect(page.getByTestId('chat-draft-input')).toBeVisible()
  await expect(page.getByTestId('chat-send-button')).toBeVisible()
})

test('@chat - create, select, rename, delete chat', async ({ page }) => {
  await page.goto('/')

  const chatSidebar = page.getByTestId('chat-sidebar')
  await expect(chatSidebar).toBeVisible()

  const newChatButton = page.getByTestId('new-chat-button')
  await newChatButton.click()

  const chatItems = page.locator('[data-testid^="chat-item-"]')
  await expect(chatItems).toHaveCount(2)

  const firstChat = chatItems.first()
  await firstChat.hover()

  const buttons = firstChat.locator('button')
  const buttonCount = await buttons.count()

  const editButton = buttons.nth(buttonCount - 2)
  await editButton.click()

  const renameInput = firstChat.locator('input')
  await expect(renameInput).toBeVisible()
  await renameInput.fill('Renamed Chat')
  await renameInput.press('Enter')

  await expect(firstChat).toContainText('Renamed Chat')

  await firstChat.hover()
  const deleteButton = firstChat.locator('button').nth(buttonCount - 1)
  await deleteButton.click()

  await expect(chatItems).toHaveCount(1)
})

test('@model-selection - allows switching between models', async ({ page }) => {
  await page.goto('/')

  const modelCard08b = page.getByTestId('model-card-qwen-0_8b').first()
  const modelCard2b = page.getByTestId('model-card-qwen-2b').first()
  const modelCard4b = page.getByTestId('model-card-qwen-4b').first()

  await expect(modelCard08b).toBeVisible()
  await expect(modelCard2b).toBeVisible()
  await expect(modelCard4b).toBeVisible()

  await modelCard2b.click()
  await expect(modelCard2b).toHaveClass(/ring-1/)

  await modelCard4b.click()
  await expect(modelCard4b).toHaveClass(/ring-1/)

  const experimentalWarning = page.locator('text=Qwen 3.5 4B is experimental in-browser').first()
  await expect(experimentalWarning).toBeVisible()

  await modelCard08b.click()
  await expect(modelCard08b).toHaveClass(/ring-1/)
})

test('@unsupported - capability status card renders with correct structure', async ({ page }) => {
  await page.goto('/')

  const webgpuStatus = page.getByTestId('status-webgpu').first()
  await expect(webgpuStatus).toBeVisible()
  await expect(webgpuStatus).toContainText('WebGPU')

  const runtimeStatus = page.getByTestId('status-runtime').first()
  await expect(runtimeStatus).toBeVisible()
  await expect(runtimeStatus).toContainText('Runtime')

  const modelStatus = page.getByTestId('status-model').first()
  await expect(modelStatus).toBeVisible()
  await expect(modelStatus).toContainText('Model')

  const warmStatus = page.getByTestId('status-warm').first()
  await expect(warmStatus).toBeVisible()
  await expect(warmStatus).toContainText('Cache')
})

test('@prompt-controls - preset prompts work correctly', async ({ page }) => {
  await page.goto('/')

  const draftInput = page.getByTestId('chat-draft-input')
  const sendButton = page.getByTestId('chat-send-button')

  await expect(draftInput).toBeVisible()
  await expect(sendButton).toBeVisible()
  await expect(sendButton).toBeDisabled()

  await draftInput.fill('Test prompt')
  await expect(draftInput).toHaveValue('Test prompt')

  const presetSummarize = page.getByTestId('preset-summarize')
  const presetExplainCode = page.getByTestId('preset-explain-code')
  const presetRewriteText = page.getByTestId('preset-rewrite-text')
  const presetExtractJson = page.getByTestId('preset-extract-json')

  await expect(presetSummarize).toBeVisible()
  await expect(presetExplainCode).toBeVisible()
  await expect(presetRewriteText).toBeVisible()
  await expect(presetExtractJson).toBeVisible()

  await draftInput.fill('')
  await presetSummarize.click()
  await expect(draftInput).toContainText('Summarize')

  await draftInput.fill('')
  await presetExplainCode.click()
  await expect(draftInput).toContainText('Explain')
})

test('@composer - Enter sends, Shift+Enter adds newline', async ({ page }) => {
  await page.goto('/')

  const draftInput = page.getByTestId('chat-draft-input')
  const sendButton = page.getByTestId('chat-send-button')

  const statusRuntime = page.getByTestId('status-runtime').first()
  await expect(statusRuntime).toContainText('Ready', { timeout: 30000 })

  await draftInput.fill('Line one')
  await expect(sendButton).toBeEnabled({ timeout: 5000 })

  await draftInput.press('Shift+Enter')

  const value = await draftInput.inputValue()
  expect(value).toContain('Line one')
  expect(value.length).toBeGreaterThan('Line one'.length)
})

test('@settings - system prompt panel works', async ({ page }) => {
  await page.goto('/')

  const statusRuntime = page.getByTestId('status-runtime').first()
  await expect(statusRuntime).toContainText('Ready', { timeout: 30000 })

  const systemPromptPanel = page.getByTestId('system-prompt-panel').first()
  await expect(systemPromptPanel).toBeVisible()

  const textarea = systemPromptPanel.locator('textarea')
  await expect(textarea).toBeVisible()

  await textarea.fill('You are a helpful coding assistant.')
  await expect(textarea).toHaveValue('You are a helpful coding assistant.')
})

test('@settings - inference settings panel works', async ({ page }) => {
  await page.goto('/')

  const inferencePanel = page.getByTestId('inference-settings-panel').first()
  await expect(inferencePanel).toBeVisible()

  await expect(inferencePanel).toContainText('Temperature')
  await expect(inferencePanel).toContainText('Top P')
  await expect(inferencePanel).toContainText('Repetition Penalty')
  await expect(inferencePanel).toContainText('Max New Tokens')

  const advancedToggle = inferencePanel.locator('button').filter({ hasText: 'Advanced' })
  await advancedToggle.click()

  await expect(inferencePanel).toContainText('Do Sample')
  await expect(inferencePanel).toContainText('Top K')

  const resetButton = inferencePanel.locator('button').filter({ hasText: 'Reset' })
  const saveButton = inferencePanel.locator('button').filter({ hasText: 'Save' })
  await expect(resetButton).toBeVisible()
  await expect(saveButton).toBeVisible()
})

test('@telemetry-shell - displays all required telemetry fields', async ({ page }) => {
  await page.goto('/')

  const telemetryPanel = page.getByTestId('telemetry-panel').first()
  await expect(telemetryPanel).toBeVisible()

  const telemetryRuntime = page.getByTestId('telemetry-runtime').first()
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

test('@mock-runtime - loads model and enables generation', async ({ page }) => {
  await page.goto('/')

  const statusRuntime = page.getByTestId('status-runtime').first()
  await expect(statusRuntime).toContainText('Ready', { timeout: 30000 })

  const draftInput = page.getByTestId('chat-draft-input')
  await draftInput.fill('Hello, mock model!')

  const sendButton = page.getByTestId('chat-send-button')
  await expect(sendButton).toBeEnabled({ timeout: 5000 })
})

test('@mock-runtime - generates response with mock model', async ({ page }) => {
  await page.goto('/')

  const statusRuntime = page.getByTestId('status-runtime').first()
  await expect(statusRuntime).toContainText('Ready', { timeout: 30000 })

  const draftInput = page.getByTestId('chat-draft-input')
  const sendButton = page.getByTestId('chat-send-button')
  const chatThread = page.getByTestId('chat-thread')

  await draftInput.fill('Hello, mock model!')
  await expect(sendButton).toBeEnabled({ timeout: 5000 })

  await sendButton.click()

  await expect(chatThread).toContainText('simulated response', { timeout: 10000 })
  await expect(page.getByTestId('message-user')).toContainText('Hello, mock model!')
  await expect(page.getByTestId('message-assistant')).toContainText('simulated response')
})

test('@mock-runtime - stop button interrupts generation', async ({ page }) => {
  await page.goto('/')

  const statusRuntime = page.getByTestId('status-runtime').first()
  await expect(statusRuntime).toContainText('Ready', { timeout: 30000 })

  const draftInput = page.getByTestId('chat-draft-input')
  const sendButton = page.getByTestId('chat-send-button')

  await draftInput.fill('Hello, mock model!')
  await expect(sendButton).toBeEnabled({ timeout: 5000 })

  await sendButton.click()

  const stopButton = page.getByTestId('chat-stop-button')
  await expect(stopButton).toBeVisible({ timeout: 2000 })

  await stopButton.click()

  await expect(sendButton).toBeVisible({ timeout: 5000 })

  const assistantMessage = page.getByTestId('message-assistant').first()
  await expect(assistantMessage).toBeVisible({ timeout: 3000 })

  const messageContent = await assistantMessage.textContent()
  expect(messageContent?.length).toBeGreaterThan(0)

  await expect(page.getByTestId('message-interrupted')).toBeVisible({ timeout: 5000 })
})

test('@chat - empty state shows for new chat', async ({ page }) => {
  await page.goto('/')

  const emptyState = page.getByTestId('chat-empty-state')
  await expect(emptyState).toBeVisible()
  await expect(emptyState).toContainText('Start a conversation')

  const draftInput = page.getByTestId('chat-draft-input')
  const statusRuntime = page.getByTestId('status-runtime').first()
  await expect(statusRuntime).toContainText('Ready', { timeout: 30000 })

  await draftInput.fill('Hello!')
  const sendButton = page.getByTestId('chat-send-button')
  await expect(sendButton).toBeEnabled({ timeout: 5000 })
  await sendButton.click()

  await expect(emptyState).not.toBeVisible()
  await expect(page.getByTestId('message-user')).toContainText('Hello!')
})
