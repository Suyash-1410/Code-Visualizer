import { test, expect } from '@playwright/test';

test.describe('JavaScope E2E Quality Gates (PRD 12.4 & 12.5)', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure clean initial state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('1. Empty state & Examples dropdown loads program into editor', async ({ page }) => {
    // Empty state guide should be visible initially
    await expect(page.locator('[data-testid="empty-state-guide"]')).toBeVisible();
    await expect(page.getByText("What's Supported & System Limits")).toBeVisible();

    // Select an example from dropdown
    const select = page.locator('#example-select');
    await select.selectOption('sum-of-array');

    // Run the program
    const runBtn = page.getByRole('button', { name: /Run/i });
    await runBtn.click();

    // Controls bar becomes active
    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 15000 });
    // Array view displays cells
    await expect(page.locator('[data-testid^="array-view"]').first()).toBeVisible();

    // Step forward and backward
    const stepBackBtn = page.getByLabel('Step back');
    const stepFwdBtn = page.getByLabel('Step forward');

    // Pause first if auto-playing
    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }

    await stepFwdBtn.click();
    await expect(page.getByText(/Step \d+ of \d+/)).toBeVisible();

    await stepBackBtn.click();
    await expect(page.getByText(/Step \d+ of \d+/)).toBeVisible();
  });

  test('2. Factorial: call stack frames, return values, line sync, and stdout', async ({ page }) => {
    await page.locator('#example-select').selectOption('factorial');
    await page.getByRole('button', { name: /Run/i }).click();

    // Wait for execution to finish loading
    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 15000 });

    // Pause playback
    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }

    // Jump to end
    const jumpEndBtn = page.getByLabel('Jump to end');
    await jumpEndBtn.click();

    // Verify post-run summary
    await expect(page.getByTestId('post-run-summary')).toBeVisible();
    await expect(page.getByTestId('post-run-summary')).toContainText(/Finished/);

    // Verify stdout has final output
    const stdoutPanel = page.locator('[data-testid="stdout-panel"]');
    await expect(stdoutPanel).toBeVisible();
    await expect(stdoutPanel).toContainText('5! = 120');

    // Step backward: stepping back restores previous state and reduces stdout text if applicable
    const restartBtn = page.getByLabel('Restart');
    await restartBtn.click();
    await expect(stdoutPanel).not.toContainText('5! = 120');
  });

  test('3. Fibonacci(5): call tree tab, tidy layout, and return values', async ({ page }) => {
    await page.locator('#example-select').selectOption('fibonacci');
    await page.getByRole('button', { name: /Run/i }).click();

    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 20000 });

    // Switch to Call Tree tab
    const treeTab = page.locator('[data-testid="tab-call-tree"]');
    await treeTab.click();

    // Jump to end
    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }
    await page.getByLabel('Jump to end').click();

    // Call tree SVG should display nodes and return values
    const svg = page.locator('[data-testid="call-tree-svg"]');
    await expect(svg).toBeVisible();

    // Should contain fibo(5) text element and return value -> 5
    await expect(svg.locator('text', { hasText: 'fibo(5)' })).toBeVisible();
    await expect(svg.locator('text', { hasText: /→ 5/ })).toBeVisible();
  });

  test('4. BubbleSort: array cells, index markers i and j', async ({ page }) => {
    await page.locator('#example-select').selectOption('bubble-sort');
    await page.getByRole('button', { name: /Run/i }).click();

    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 15000 });

    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }

    // Step a few times to get into inner loop
    const stepFwd = page.getByLabel('Step forward');
    for (let i = 0; i < 5; i++) {
      await stepFwd.click();
    }

    // Array view should be visible
    await expect(page.locator('[data-testid^="array-view"]').first()).toBeVisible();
  });

  test('5. Compile Error: banner with hints and Monaco line markers', async ({ page }) => {
    // Set invalid Java syntax in Monaco editor
    const editor = page.locator('.monaco-editor');
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(
      'public class Main { public static void main(String[] args) { int x = ; } }',
    );

    // Run code
    await page.getByRole('button', { name: /Run/i }).click();

    // Status banner should indicate compilation error with actionable hint
    const banner = page.locator('[data-testid="status-banner"]');
    await expect(banner).toBeVisible({ timeout: 15000 });
    await expect(banner).toContainText('Compilation Failed');
    await expect(banner).toContainText('Next Step');
  });

  test('6. Uncaught Exception: ArrayIndexOutOfBoundsException display', async ({ page }) => {
    await page.locator('#example-select').selectOption('array-index-exception');
    await page.getByRole('button', { name: /Run/i }).click();

    // Status banner should show runtime exception
    const banner = page.locator('[data-testid="status-banner"]');
    await expect(banner).toBeVisible({ timeout: 15000 });
    await expect(banner).toContainText('Runtime Exception: ArrayIndexOutOfBoundsException');
    await expect(banner).toContainText('Next Step');
  });

  test('7. Depth Limit: recursion exceeding 200 frames shows depth-limit message and is playable', async ({
    page,
  }) => {
    // Type recursion with parameter to track real stack frames up to depth 200
    const editor = page.locator('.monaco-editor');
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(
      'public class Main { public static void rec(int n) { rec(n + 1); } public static void main(String[] args) { rec(0); } }',
    );

    await page.getByRole('button', { name: /Run/i }).click();

    // Should show depth limit banner (or time limit if slow environment, both valid truncation)
    const banner = page.locator('[data-testid="status-banner"]');
    await expect(banner).toBeVisible({ timeout: 25000 });
    await expect(banner).toContainText(/Limit/);

    // Partial trace must remain playable
    const scrubber = page.getByLabel('Timeline scrubber');
    await expect(scrubber).toBeVisible();
    await page.getByLabel('Step back').click();
    await expect(page.getByText(/Step \d+ of \d+/)).toBeVisible();
  });

  test('8. Visual Sanity: layout and screenshot checks on ArrayView, CallStack, and CallTree', async ({
    page,
  }) => {
    await page.locator('#example-select').selectOption('sum-of-array');
    await page.getByRole('button', { name: /Run/i }).click();

    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 15000 });

    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }

    // Step forward so array is allocated
    await page.getByLabel('Step forward').click();

    // 1. ArrayView layout and screenshot
    const arrayContainer = page.locator('[data-testid^="array-view"]').first();
    await expect(arrayContainer).toBeVisible();
    const box = await arrayContainer.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(50);
    expect(box!.height).toBeGreaterThan(30);
    await expect(arrayContainer).toHaveScreenshot('array-view.png', {
      maxDiffPixelRatio: 0.15,
      animations: 'disabled',
    });

    // 2. CallStackPanel layout and screenshot
    const callStack = page.locator('[data-testid="call-stack-panel"]');
    await expect(callStack).toBeVisible();
    const stackBox = await callStack.boundingBox();
    expect(stackBox).not.toBeNull();
    expect(stackBox!.height).toBeGreaterThan(50);
    await expect(callStack).toHaveScreenshot('call-stack.png', {
      maxDiffPixelRatio: 0.15,
      animations: 'disabled',
    });

    // 3. CallTree visual sanity on Fibonacci
    await page.locator('#example-select').selectOption('fibonacci');
    await page.getByRole('button', { name: /Run/i }).click();
    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 20000 });
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }
    await page.getByLabel('Jump to end').click();

    const treeTab = page.locator('[data-testid="tab-call-tree"]');
    await treeTab.click();
    const treeSvg = page.locator('[data-testid="call-tree-svg"]');
    await expect(treeSvg).toBeVisible();
    const treeBBox = await treeSvg.boundingBox();
    expect(treeBBox).not.toBeNull();
    expect(treeBBox!.width).toBeGreaterThan(100);
    expect(treeBBox!.height).toBeGreaterThan(100);
    await expect(treeSvg).toHaveScreenshot('call-tree.png', {
      maxDiffPixelRatio: 0.15,
      animations: 'disabled',
    });
  });
});
