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
