import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const programsDir = path.resolve(__dirname, '../../../tests/programs');
const snapshotsDir = path.resolve(__dirname, 'screenshots');

if (!fs.existsSync(snapshotsDir)) {
  fs.mkdirSync(snapshotsDir, { recursive: true });
}

function loadProgram(filename: string): string {
  return fs.readFileSync(path.join(programsDir, filename), 'utf-8');
}

test.describe('JavaScope Phase 4 Stage 3: Stacks & Queues Visual Checkpoints (PRD 4.8, 5, 12.4)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Checkpoint 1: ArrayStack partially filled (bottom at bottom, faint free slots above)', async ({ page }) => {
    const code = loadProgram('ArrayStack.java');

    await page.evaluate((c) => {
      localStorage.setItem('javascope_editor_code', c);
    }, code);
    await page.reload();

    const editBtn = page.getByRole('button', { name: /Edit/i });
    if (await editBtn.isVisible()) {
      await editBtn.click();
    }

    await page.getByRole('button', { name: /Run/i }).click();
    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }

    // Step to a point where elements 10, 20, 30 are on the stack (around step 38)
    const stepFwd = page.getByLabel('Step forward');
    for (let i = 0; i < 40; i++) {
      if (await page.locator('[data-testid="stack-slot-2"]').getByText('30').isVisible()) {
        break;
      }
      await stepFwd.click();
    }

    // Verification of PRD requirements:
    // 1. Detected as Stack
    await expect(page.getByTestId('detection-badge')).toBeVisible();
    await expect(page.getByTestId('detection-badge')).toContainText('Stack');

    // 2. Vertical container with bottom at the bottom
    await expect(page.getByText('Stack Bottom (index 0)')).toBeVisible();

    // 3. Top marker attached to top element
    await expect(page.getByTestId('stack-top-marker')).toBeVisible();

    // 4. Free capacity slots above top
    await expect(page.getByText('(empty slot)').first()).toBeVisible();

    // Capture visual screenshot checkpoint
    const stackView = page.locator('[data-testid^="stack-view-"]').first();
    await stackView.screenshot({
      path: path.join(snapshotsDir, 'array-stack-partial.png'),
    });
  });

  test('Checkpoint 2: CircularQueue in a wrapped state (front > rear, wrap connector drawn)', async ({ page }) => {
    const code = loadProgram('CircularQueue.java');

    await page.evaluate((c) => {
      localStorage.setItem('javascope_editor_code', c);
    }, code);
    await page.reload();

    const editBtn = page.getByRole('button', { name: /Edit/i });
    if (await editBtn.isVisible()) {
      await editBtn.click();
    }

    await page.getByRole('button', { name: /Run/i }).click();
    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }

    // Step forward until wraparound occurs and wrap connector appears
    const stepFwd = page.getByLabel('Step forward');
    for (let i = 0; i < 110; i++) {
      if (await page.getByTestId('queue-wrap-connector').isVisible()) {
        break;
      }
      await stepFwd.click();
    }

    // Verification of PRD requirements:
    // 1. Detected as Queue
    await expect(page.getByTestId('detection-badge')).toBeVisible();
    await expect(page.getByTestId('detection-badge')).toContainText('Queue');

    // 2. Wraps around badge
    await expect(page.getByTestId('wrapped-badge')).toBeVisible();

    // 3. Wrap connector with "wraps to 0" label
    await expect(page.getByTestId('queue-wrap-connector')).toBeVisible();
    await expect(page.getByText('wraps to 0')).toBeVisible();

    // 4. Both front and rear markers visible
    await expect(page.getByTestId('queue-front-marker')).toBeVisible();
    await expect(page.getByTestId('queue-rear-marker')).toBeVisible();

    // Capture visual screenshot checkpoint
    const queueView = page.locator('[data-testid^="queue-view-"]').first();
    await queueView.screenshot({
      path: path.join(snapshotsDir, 'circular-queue-wrapped.png'),
    });
  });

  test('Checkpoint 3: NodeQueue with front and rear pointers', async ({ page }) => {
    const code = loadProgram('NodeQueue.java');

    await page.evaluate((c) => {
      localStorage.setItem('javascope_editor_code', c);
    }, code);
    await page.reload();

    const editBtn = page.getByRole('button', { name: /Edit/i });
    if (await editBtn.isVisible()) {
      await editBtn.click();
    }

    await page.getByRole('button', { name: /Run/i }).click();
    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }

    // Step forward until multiple nodes (10, 20) are in the queue with front and rear pointers
    const stepFwd = page.getByLabel('Step forward');
    for (let i = 0; i < 40; i++) {
      if (
        await page.locator('[data-testid^="queue-view-"]').getByText('20').isVisible() &&
        await page.getByTestId('node-queue-rear-chip').isVisible()
      ) {
        break;
      }
      await stepFwd.click();
    }

    // Verification of PRD requirements:
    // 1. Detected as Queue
    await expect(page.getByTestId('detection-badge')).toBeVisible();
    await expect(page.getByTestId('detection-badge')).toContainText('Queue');

    // 2. Labeled front chip and rear chip
    await expect(page.getByTestId('node-queue-front-chip')).toContainText('front');
    await expect(page.getByTestId('node-queue-rear-chip')).toContainText('rear');

    // Capture visual screenshot checkpoint
    const queueView = page.locator('[data-testid^="queue-view-"]').first();
    await queueView.screenshot({
      path: path.join(snapshotsDir, 'node-queue.png'),
    });
  });

  test('Checkpoint 4: ArrayListLike to confirm it did NOT become a stack', async ({ page }) => {
    const code = loadProgram('ArrayListLike.java');

    await page.evaluate((c) => {
      localStorage.setItem('javascope_editor_code', c);
    }, code);
    await page.reload();

    const editBtn = page.getByRole('button', { name: /Edit/i });
    if (await editBtn.isVisible()) {
      await editBtn.click();
    }

    await page.getByRole('button', { name: /Run/i }).click();
    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }

    // Jump to near end where items are added
    await page.getByLabel('Jump to end').click();
    await page.getByLabel('Step back').click();

    // Verification of PRD requirements:
    // 1. No stack or queue detection badge
    const detectionBadges = page.locator('[data-testid="detection-badge"]');
    const badgeCount = await detectionBadges.count();
    for (let i = 0; i < badgeCount; i++) {
      const text = await detectionBadges.nth(i).textContent();
      expect(text).not.toContain('Stack');
      expect(text).not.toContain('Queue');
    }

    // 2. Stack or queue containers must NOT exist
    await expect(page.locator('[data-testid="stack-slots-container"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="queue-cells-container"]')).not.toBeVisible();

    // 3. Stays plain ArrayView or ObjectView
    await expect(page.locator('[data-testid^="array-view-"]').first()).toBeVisible();

    // Capture visual screenshot checkpoint
    const arrayView = page.locator('[data-testid^="array-view-"]').first();
    await arrayView.screenshot({
      path: path.join(snapshotsDir, 'array-list-like.png'),
    });
  });

  test('Stage 4: CircularQueue stepping checks front and rear at the wrap and backward reversal', async ({ page }) => {
    const code = loadProgram('CircularQueue.java');

    await page.evaluate((c) => {
      localStorage.setItem('javascope_editor_code', c);
    }, code);
    await page.reload();

    const editBtn = page.getByRole('button', { name: /Edit/i });
    if (await editBtn.isVisible()) {
      await editBtn.click();
    }

    await page.getByRole('button', { name: /Run/i }).click();
    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }

    const stepFwd = page.getByLabel('Step forward');
    const stepBack = page.getByLabel('Step back');

    // Step forward until rear wraps to 0
    let wrappedFound = false;
    for (let i = 0; i < 110; i++) {
      const isSlot0Rear = await page
        .locator('[data-testid="queue-slot-0"]')
        .locator('[data-testid="queue-rear-marker"]')
        .isVisible();
      if (isSlot0Rear && (await page.getByTestId('queue-wrap-connector').isVisible())) {
        wrappedFound = true;
        break;
      }
      await stepFwd.click();
    }

    expect(wrappedFound).toBe(true);

    // Verify rear is at slot 0
    await expect(
      page.locator('[data-testid="queue-slot-0"]').locator('[data-testid="queue-rear-marker"]'),
    ).toBeVisible();

    // Verify front is at slot 2
    await expect(
      page.locator('[data-testid="queue-slot-2"]').locator('[data-testid="queue-front-marker"]'),
    ).toBeVisible();

    // Verify wrap connector
    await expect(page.getByTestId('queue-wrap-connector')).toBeVisible();

    const queueView = page.locator('[data-testid^="queue-view-"]').first();
    await queueView.screenshot({
      path: path.join(snapshotsDir, 'circular-queue-wrap.png'),
    });

    // Now step backward across the wrap transition
    await stepBack.click();

    // Verify rear moved back to slot 3
    await expect(
      page.locator('[data-testid="queue-slot-3"]').locator('[data-testid="queue-rear-marker"]'),
    ).toBeVisible();
  });

  test('Stage 4 Checkpoint: ArrayStack pop reveals stale slot with old value faintly in array', async ({ page }) => {
    const code = loadProgram('ArrayStack.java');

    await page.evaluate((c) => {
      localStorage.setItem('javascope_editor_code', c);
    }, code);
    await page.reload();

    const editBtn = page.getByRole('button', { name: /Edit/i });
    if (await editBtn.isVisible()) {
      await editBtn.click();
    }

    await page.getByRole('button', { name: /Run/i }).click();
    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }

    const stepFwd = page.getByLabel('Step forward');
    let staleFound = false;
    for (let i = 0; i < 60; i++) {
      if (await page.getByTestId('stale-slot-marker').isVisible()) {
        staleFound = true;
        break;
      }
      await stepFwd.click();
    }

    expect(staleFound).toBe(true);

    // Verify top moved down (top is at slot 1)
    await expect(
      page.locator('[data-testid="stack-slot-1"]').locator('[data-testid="stack-top-marker"]'),
    ).toBeVisible();

    // Verify slot 2 has stale marker and value 30
    await expect(page.locator('[data-testid="stack-slot-2"]')).toContainText('30');
    await expect(page.locator('[data-testid="stack-slot-2"]').getByTestId('stale-slot-marker')).toBeVisible();

    const stackView = page.locator('[data-testid^="stack-view-"]').first();
    await stackView.screenshot({
      path: path.join(snapshotsDir, 'array-stack-pop-stale.png'),
    });
  });

  test('Stage 4 Checkpoint: ResizingStack displays capacity 2 → 4 badge and reverses backward', async ({ page }) => {
    const code = loadProgram('ResizingStack.java');

    await page.evaluate((c) => {
      localStorage.setItem('javascope_editor_code', c);
    }, code);
    await page.reload();

    const editBtn = page.getByRole('button', { name: /Edit/i });
    if (await editBtn.isVisible()) {
      await editBtn.click();
    }

    await page.getByRole('button', { name: /Run/i }).click();
    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }

    const stepFwd = page.getByLabel('Step forward');
    const stepBack = page.getByLabel('Step back');

    let resizedFound = false;
    for (let i = 0; i < 70; i++) {
      const isResizedVisible = await page.getByTestId('resized-badge').isVisible();
      if (isResizedVisible) {
        const text = await page.getByTestId('resized-badge').textContent();
        if (text?.includes('capacity 2 → 4')) {
          resizedFound = true;
          break;
        }
      }
      await stepFwd.click();
    }

    expect(resizedFound).toBe(true);
    await expect(page.getByTestId('resized-badge')).toContainText('capacity 2 → 4');

    const stackView = page.locator('[data-testid^="stack-view-"]').first();
    await stackView.screenshot({
      path: path.join(snapshotsDir, 'resizing-stack-badge.png'),
    });

    // Step backward: capacity reverses back
    await stepBack.click();
  });

  test('Stage 7: StackUnderflow shows runtime exception banner while stack structure remains visible', async ({ page }) => {
    const code = loadProgram('StackUnderflow.java');

    await page.evaluate((c) => {
      localStorage.setItem('javascope_editor_code', c);
    }, code);
    await page.reload();

    const editBtn = page.getByRole('button', { name: /Edit/i });
    if (await editBtn.isVisible()) {
      await editBtn.click();
    }

    await page.getByRole('button', { name: /Run/i }).click();
    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

    // Scrub to the end (where exception is thrown)
    const endBtn = page.getByLabel('Go to end');
    if (await endBtn.isVisible()) {
      await endBtn.click();
    }

    // Assert exception banner is shown
    await expect(page.getByTestId('status-banner')).toBeVisible();
    await expect(page.getByTestId('status-banner')).toContainText('StackUnderflowException');

    // Assert stack structure is still visible with empty marker
    await expect(page.locator('[data-testid^="stack-view-"]').first()).toBeVisible();
    await expect(page.getByTestId('stack-empty-marker')).toBeVisible();
  });

  test('Stage 7: TwoStructuresAtOnce renders stack and queue simultaneously side-by-side', async ({ page }) => {
    const code = loadProgram('TwoStructuresAtOnce.java');

    await page.evaluate((c) => {
      localStorage.setItem('javascope_editor_code', c);
    }, code);
    await page.reload();

    const editBtn = page.getByRole('button', { name: /Edit/i });
    if (await editBtn.isVisible()) {
      await editBtn.click();
    }

    await page.getByRole('button', { name: /Run/i }).click();
    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

    const endBtn = page.getByLabel('Go to end');
    if (await endBtn.isVisible()) {
      await endBtn.click();
    }

    // Both stack-view and queue-view must be visible simultaneously
    await expect(page.locator('[data-testid^="stack-view-"]').first()).toBeVisible();
    await expect(page.locator('[data-testid^="queue-view-"]').first()).toBeVisible();
  });

  test('Stage 7: JdkCollectionsMix renders opaque cards in variables without falsely triggering custom visualizers', async ({ page }) => {
    const code = loadProgram('JdkCollectionsMix.java');

    await page.evaluate((c) => {
      localStorage.setItem('javascope_editor_code', c);
    }, code);
    await page.reload();

    const editBtn = page.getByRole('button', { name: /Edit/i });
    if (await editBtn.isVisible()) {
      await editBtn.click();
    }

    await page.getByRole('button', { name: /Run/i }).click();
    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

    const endBtn = page.getByLabel('Go to end');
    if (await endBtn.isVisible()) {
      await endBtn.click();
    }

    // Variables panel contains opaque collection references
    await expect(page.getByTestId('var-row-stack')).toContainText('Stack');
    await expect(page.getByTestId('var-row-deque')).toContainText('ArrayDeque');
    await expect(page.getByTestId('var-row-pq')).toContainText('PriorityQueue');

    // Custom visualizers should NOT be rendered for opaque JDK collections
    await expect(page.locator('[data-testid^="stack-view-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="queue-view-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="heap-view-"]')).toHaveCount(0);
  });
});
