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
