import { expect, test, type Page } from '@playwright/test'

async function waitForRuntimeReady(page: Page) {
  const runtimeStatus = page.getByTestId('status-runtime').first()
  await expect(runtimeStatus).toContainText('Ready', { timeout: 30000 })
  return runtimeStatus
}

test('@shell - renders editorial showcase layout', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId('showcase-page')).toBeVisible()
  await expect(page.getByTestId('chat-sidebar')).toBeVisible()
  await expect(page.getByTestId('chat-thread')).toBeVisible()
  await expect(page.getByTestId('chat-composer')).toBeVisible()
  await expect(page.getByTestId('chat-settings-rail')).toBeVisible()
  await expect(page.getByTestId('new-chat-button')).toBeVisible()
  await expect(page.getByTestId('selected-model-card')).toBeVisible()
  await expect(page.getByTestId('context-window-panel')).toBeVisible()
})

test('@chat - create, rename, select, and delete chats', async ({ page }) => {
  await page.goto('/')
  await waitForRuntimeReady(page)

  const newChatButton = page.getByTestId('new-chat-button')
  await newChatButton.click()

  const chatItems = page.locator('[data-testid^="chat-item-"]')
  await expect(chatItems).toHaveCount(2)

  const firstChat = chatItems.first()
  await expect(firstChat).toContainText(/new conversation|untitled|chat/i)

  await firstChat.getByRole('button', { name: /rename/i }).click()
  const renameInput = firstChat.getByLabel('Rename conversation')
  await renameInput.fill('Renamed Chat')
  await renameInput.press('Enter')
  await expect(firstChat).toContainText('Renamed Chat')

  const secondChat = chatItems.nth(1)
  await secondChat.getByRole('button').first().click()
  await expect(secondChat.getByRole('button').first()).toHaveAttribute('aria-current', 'page')

  await firstChat.getByRole('button', { name: /delete/i }).click()
  await expect(chatItems).toHaveCount(1)
})

test('@model-selection - switches models and shows warning copy', async ({ page }) => {
  await page.goto('/')

  const model08b = page.getByTestId('model-card-qwen-0_8b').first()
  const model2b = page.getByTestId('model-card-qwen-2b').first()
  const model4b = page.getByTestId('model-card-qwen-4b').first()

  await expect(model08b).toHaveAttribute('aria-selected', 'true')
  await model2b.click()
  await expect(model2b).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('selected-model-card')).toContainText('Qwen 3.5 2B')

  await model4b.click()
  await expect(model4b).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('model-warning')).toContainText(
    'Qwen 3.5 4B is experimental in-browser'
  )

  await model08b.click()
  await expect(model08b).toHaveAttribute('aria-selected', 'true')
})

test('@status - system status blocks render expected labels', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId('status-webgpu')).toContainText('WebGPU')
  await expect(page.getByTestId('status-runtime')).toContainText('Runtime')
  await expect(page.getByTestId('status-model')).toContainText('Model')
  await expect(page.getByTestId('status-warm')).toContainText('Cache')
})

test('@prompt-controls - preset prompts populate the draft', async ({ page }) => {
  await page.goto('/')

  const draftInput = page.getByTestId('chat-draft-input')
  await expect(draftInput).toBeVisible()

  await draftInput.fill('')
  await page.getByTestId('preset-summarize').click()
  await expect(draftInput).toHaveValue(/Summarize the following/i)

  await draftInput.fill('')
  await page.getByTestId('preset-explain-code').click()
  await expect(draftInput).toHaveValue(/Explain this code clearly/i)

  await draftInput.fill('')
  await page.getByTestId('preset-extract-json').click()
  await expect(draftInput).toHaveValue(/Return valid minified JSON only/i)
})

test('@composer - Enter sends and Shift+Enter keeps multiline input', async ({ page }) => {
  await page.goto('/')

  await waitForRuntimeReady(page)

  const draftInput = page.getByTestId('chat-draft-input')
  const sendButton = page.getByTestId('chat-send-button')

  await draftInput.fill('Line one')
  await expect(sendButton).toBeEnabled({ timeout: 5000 })
  await draftInput.press('Shift+Enter')

  const multilineValue = await draftInput.inputValue()
  expect(multilineValue).toContain('Line one')
  expect(multilineValue.length).toBeGreaterThan('Line one'.length)

  await draftInput.fill('Send with enter')
  await draftInput.press('Enter')

  await expect(page.getByTestId('message-user').first()).toContainText('Send with enter')
})

test('@settings - system prompt panel is editable', async ({ page }) => {
  await page.goto('/')

  await waitForRuntimeReady(page)

  const systemPromptPanel = page.getByTestId('system-prompt-panel')
  const textarea = systemPromptPanel.getByRole('textbox', { name: 'System prompt' })

  await expect(systemPromptPanel).toBeVisible()
  await textarea.fill('You are a meticulous local showcase assistant.')
  await expect(textarea).toHaveValue('You are a meticulous local showcase assistant.')
})

test('@settings - inference settings panel exposes controls', async ({ page }) => {
  await page.goto('/')

  const inferencePanel = page.getByTestId('inference-settings-panel')
  await expect(inferencePanel).toContainText('Mode')
  await expect(inferencePanel.getByRole('button', { name: 'Direct' })).toBeVisible()
  await expect(inferencePanel.getByRole('button', { name: 'Thinking' })).toBeVisible()
  await expect(inferencePanel.getByRole('button', { name: 'Thinking' })).toBeDisabled()
  await expect(inferencePanel).toContainText('Temperature')
  await expect(inferencePanel).toContainText('Top P')
  await expect(inferencePanel).toContainText('Presence')
  await expect(inferencePanel).toContainText('Rep. Penalty')
  await expect(inferencePanel).toContainText('Max Tokens')
  await expect(inferencePanel.getByTestId('thinking-unsupported-note')).toBeVisible()
  await expect(inferencePanel).not.toContainText('Top K')
  await expect(inferencePanel).not.toContainText('Min P')
  await expect(inferencePanel).not.toContainText('Do Sample')
  await inferencePanel.getByTestId('inference-advanced-toggle').click()
  await expect(inferencePanel).toContainText('Top K')
  await expect(inferencePanel).toContainText('Min P')
  await expect(inferencePanel).toContainText('Do Sample')
  await expect(inferencePanel.getByRole('button', { name: 'Reset' })).toBeVisible()
  await expect(inferencePanel.getByRole('button', { name: 'Save Default' })).toBeVisible()
})

test('@settings - 0.8b stays direct while 2b defaults back to thinking output', async ({ page }) => {
  await page.goto('/')

  await waitForRuntimeReady(page)

  const inferencePanel = page.getByTestId('inference-settings-panel')
  const directButton = inferencePanel.getByRole('button', { name: 'Direct' })
  const thinkingButton = inferencePanel.getByRole('button', { name: 'Thinking' })
  const draftInput = page.getByTestId('chat-draft-input')
  const model2b = page.getByTestId('model-card-qwen-2b').first()

  await expect(directButton).toBeDisabled()
  await expect(thinkingButton).toBeDisabled()
  await draftInput.fill('Answer directly.')
  await draftInput.press('Enter')
  await expect(page.getByTestId('message-assistant').first()).toContainText('This is', {
    timeout: 10000,
  })
  await expect(page.getByTestId('message-think-block')).toHaveCount(0)

  await model2b.click()
  await waitForRuntimeReady(page)
  await expect(thinkingButton).toBeDisabled()
  await draftInput.fill('Think first.')
  await draftInput.press('Enter')
  const thinkBlock = page.getByTestId('message-think-block').last()
  await expect(thinkBlock).toBeVisible()
  const toggle = thinkBlock.getByRole('button', { name: /thinking/i })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(thinkBlock).toContainText('Inspecting the request')
})

test('@telemetry-shell - displays required telemetry fields', async ({ page }) => {
  await page.goto('/')

  const contextPanel = page.getByTestId('context-window-panel')
  const telemetryPanel = page.getByTestId('telemetry-panel')
  await expect(contextPanel).toBeVisible()
  await expect(page.getByTestId('context-window-meter')).toBeVisible()
  await expect(contextPanel).toContainText('Context Window')
  await expect(contextPanel).toContainText('262K')
  await expect(contextPanel).toContainText('Remaining')
  await expect(telemetryPanel).toBeVisible()
  await expect(page.getByTestId('telemetry-runtime')).toBeVisible()

  await expect(telemetryPanel).toContainText('Model')
  await expect(telemetryPanel).toContainText('Phase')
  await expect(telemetryPanel).toContainText('Speed')
  await expect(telemetryPanel).toContainText('Memory')

  await contextPanel.getByTestId('context-window-details-toggle').click()
  await expect(contextPanel).toContainText('System Prompt')
  await expect(contextPanel).toContainText('Draft')

  await telemetryPanel.getByTestId('telemetry-details-toggle').click()
  await expect(telemetryPanel).toContainText('Repository')
  await expect(telemetryPanel).toContainText('Support Tier')
  await expect(telemetryPanel).toContainText('Runtime')
  await expect(telemetryPanel).toContainText('Backend')
  await expect(telemetryPanel).toContainText('Warm State')
  await expect(telemetryPanel).toContainText('shader-f16')
  await expect(telemetryPanel).toContainText('Max Buffer')
  await expect(telemetryPanel).toContainText('Max Storage Buffer')
  await expect(telemetryPanel).toContainText('Generation Duration')
})

test('@mock-runtime - sends and renders a simulated response', async ({ page }) => {
  await page.goto('/')

  await waitForRuntimeReady(page)

  await page.getByTestId('model-card-qwen-2b').first().click()
  await waitForRuntimeReady(page)

  const draftInput = page.getByTestId('chat-draft-input')
  const sendButton = page.getByTestId('chat-send-button')
  await draftInput.fill('Hello, mock model!')
  await expect(sendButton).toBeEnabled({ timeout: 5000 })
  await draftInput.press('Enter')

  await expect(page.getByTestId('message-user').first()).toContainText('Hello, mock model!')
  await expect(page.getByTestId('message-assistant').first()).toContainText('This is', {
    timeout: 10000,
  })
  const thinkBlock = page.getByTestId('message-think-block').first()
  await expect(thinkBlock).toBeVisible()
  const toggle = thinkBlock.getByRole('button', { name: /thinking/i })
  await toggle.click()
  await expect(thinkBlock).toContainText('Inspecting the request')
})

test('@mock-runtime - stop button interrupts generation', async ({ page }) => {
  await page.goto('/')

  await waitForRuntimeReady(page)

  const draftInput = page.getByTestId('chat-draft-input')
  const sendButton = page.getByTestId('chat-send-button')
  await draftInput.fill('Hello, mock model!')
  await expect(sendButton).toBeEnabled({ timeout: 5000 })
  await sendButton.click()

  const stopButton = page.getByTestId('chat-stop-button')
  await expect(stopButton).toBeVisible({ timeout: 5000 })
  await stopButton.click({ force: true })

  await expect(page.getByTestId('chat-send-button')).toBeVisible({ timeout: 5000 })
  await expect(page.getByTestId('message-assistant').first()).toBeVisible({ timeout: 3000 })
  await expect(page.getByTestId('message-interrupted')).toBeVisible({ timeout: 5000 })
})

test('@chat - empty state transitions into a conversation', async ({ page }) => {
  await page.goto('/')

  const emptyState = page.getByTestId('chat-empty-state')
  await expect(emptyState).toBeVisible()
  await expect(emptyState).toContainText('Start a local conversation')

  await waitForRuntimeReady(page)

  const draftInput = page.getByTestId('chat-draft-input')
  const sendButton = page.getByTestId('chat-send-button')
  await draftInput.fill('Hello!')
  await expect(sendButton).toBeEnabled({ timeout: 5000 })
  await draftInput.press('Enter')

  await expect(page.getByTestId('message-user').first()).toContainText('Hello!')
  await expect(emptyState).not.toBeVisible()
  await expect(page.getByTestId('message-user').first()).toContainText('Hello!')
})

test('@routing - removed numbered routes return not found', async ({ page }) => {
  for (const route of ['/1', '/2', '/3', '/4', '/5']) {
    const response = await page.goto(route)

    expect(response).not.toBeNull()
    expect(response?.status()).toBe(404)
    await expect(page).toHaveURL(new RegExp(`${route.replace('/', '\\/')}$`))
  }
})
