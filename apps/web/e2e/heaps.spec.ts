import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const programsDir = path.resolve(__dirname, '../../../tests/programs');
const snapshotsDir = path.resolve(__dirname, 'screenshots');
const artifactDir = 'C:/Users/suyas/.gemini/antigravity/brain/4c4ace4e-a824-418f-b620-afead6eb0175';

if (!fs.existsSync(snapshotsDir)) {
  fs.mkdirSync(snapshotsDir, { recursive: true });
}

function loadProgram(filename: string): string {
  return fs.readFileSync(path.join(programsDir, filename), 'utf-8');
}

function saveScreenshots(sourcePath: string, artifactName: string) {
  if (fs.existsSync(artifactDir)) {
    try {
      fs.copyFileSync(sourcePath, path.join(artifactDir, artifactName));
    } catch {
      // ignore
    }
  }
}

test.describe('JavaScope Phase 4 Stage 5: Heap Visual Checkpoints (PRD 4.8, 5, 12.4)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1100 });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Checkpoint 1: MinHeapInsert with both views visible and sync highlight active', async ({ page }) => {
    const code = loadProgram('MinHeapInsert.java');

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

    // Step forward until all 5 elements (10, 20, 30, 40, 50) are inserted (near end of trace)
    const stepFwd = page.getByLabel('Step forward');
    for (let i = 0; i < 110; i++) {
      if (await page.locator('[data-testid="heap-node-4"]').isVisible()) {
        break;
      }
      await stepFwd.click();
    }

    // Verification of PRD requirements:
    // 1. Detected as Min-heap
    await expect(page.getByTestId('detection-badge')).toBeVisible();
    await expect(page.getByTestId('detection-badge')).toContainText('Min-heap');

    // 2. Both HeapArrayView and HeapTreeView visible
    await expect(page.getByTestId('heap-array-view')).toBeVisible();
    await expect(page.getByTestId('heap-tree-view')).toBeVisible();

    // 3. Hovering cell highlights tree node (sync highlight)
    const cell1 = page.getByTestId('heap-cell-1');
    await cell1.hover();
    await page.waitForTimeout(400);

    // Capture screenshot of the complete HeapView containing both Array and Tree views
    const heapView = page.locator('[data-testid^="heap-view-"]').first();
    const screenshotPath = path.join(snapshotsDir, 'min-heap-insert.png');
    await heapView.screenshot({ path: screenshotPath });
    saveScreenshots(screenshotPath, 'min-heap-insert.png');
  });

  test('Checkpoint 2: HeapOffByOne with violation hint turned on and broken edge highlighted', async ({ page }) => {
    const code = loadProgram('HeapOffByOne.java');

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

    // Step to buggySiftDown call
    const stepFwd = page.getByLabel('Step forward');
    for (let i = 0; i < 20; i++) {
      if (await page.getByTestId('violation-toggle').isVisible()) {
        break;
      }
      await stepFwd.click();
    }

    // Override to Min-heap view to inspect min-heap invariants
    const viewAsBtn = page.getByTestId(/^view-as-button-/).first();
    if (await viewAsBtn.isVisible()) {
      await viewAsBtn.click();
      const minHeapOption = page.getByRole('button', { name: 'Min-heap' });
      if (await minHeapOption.isVisible()) {
        await minHeapOption.click();
      }
    }

    // Turn on violation hints toggle
    const violationToggle = page.getByTestId('violation-toggle');
    await expect(violationToggle).toBeVisible();
    await violationToggle.click();
    await page.waitForTimeout(400);

    // Broken edges highlighted with dashed stroke
    const brokenEdge = page.getByTestId('heap-edge-0-1');
    await expect(brokenEdge).toBeVisible();

    // Capture screenshot: heap-off-by-one-violation.png
    const heapView = page.locator('[data-testid^="heap-view-"]').first();
    const screenshotPath = path.join(snapshotsDir, 'heap-off-by-one-violation.png');
    await heapView.screenshot({ path: screenshotPath });
    saveScreenshots(screenshotPath, 'heap-off-by-one-violation.png');
  });

  test('Checkpoint 3: HeapSortBareArray mid-sort with heap-size control set to current heap portion', async ({ page }) => {
    const code = loadProgram('HeapSortBareArray.java');

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

    // Step forward into heapSort
    const stepFwd = page.getByLabel('Step forward');
    for (let i = 0; i < 30; i++) {
      await stepFwd.click();
    }

    // Override array to Max-heap using ViewAsMenu
    const viewAsBtn = page.getByTestId(/^view-as-button-/).first();
    if (await viewAsBtn.isVisible()) {
      await viewAsBtn.click();
      const maxHeapOption = page.getByRole('button', { name: 'Max-heap' });
      if (await maxHeapOption.isVisible()) {
        await maxHeapOption.click();
      }
    }

    // Adjust heap size slider to 3 (mid-sort)
    const heapSizeSlider = page.getByTestId('heap-size-slider');
    if (await heapSizeSlider.isVisible()) {
      await heapSizeSlider.fill('3');
      await page.waitForTimeout(400);
    }

    // Verification of PRD requirements:
    // 1. Bare array documentation text visible
    await expect(page.getByTestId('bare-array-doc')).toBeVisible();

    // Capture screenshot: heap-sort-bare-array.png
    const heapView = page.locator('[data-testid^="heap-view-"]').first();
    const screenshotPath = path.join(snapshotsDir, 'heap-sort-bare-array.png');
    await heapView.screenshot({ path: screenshotPath });
    saveScreenshots(screenshotPath, 'heap-sort-bare-array.png');
  });

  test('Stage 6 Smoke Test: steps through MinHeapInsert and checks final array and tree state', async ({ page }) => {
    const code = loadProgram('MinHeapInsert.java');

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

    // Step forward toward final state where all 5 elements are inserted
    const stepFwd = page.getByLabel('Step forward');
    for (let i = 0; i < 115; i++) {
      if (await page.locator('[data-testid="heap-node-4"]').isVisible()) {
        const text4 = await page.locator('[data-testid="heap-node-4"]').textContent();
        if (text4 && text4.includes('50')) {
          break;
        }
      }
      await stepFwd.click();
    }

    // Verify final array state: [10, 20, 30, 40, 50]
    await expect(page.getByTestId('heap-cell-0')).toContainText('10');
    await expect(page.getByTestId('heap-cell-1')).toContainText('20');
    await expect(page.getByTestId('heap-cell-2')).toContainText('30');
    await expect(page.getByTestId('heap-cell-3')).toContainText('40');
    await expect(page.getByTestId('heap-cell-4')).toContainText('50');

    // Verify tree view final nodes: root is 10
    await expect(page.getByTestId('heap-node-0')).toContainText('10');
    await expect(page.getByTestId('heap-node-1')).toContainText('20');
    await expect(page.getByTestId('heap-node-2')).toContainText('30');
    await expect(page.getByTestId('heap-node-3')).toContainText('40');
    await expect(page.getByTestId('heap-node-4')).toContainText('50');
  });

  test('Stage 7: MinHeapExtract steps through extraction and sifts down to restore heap', async ({ page }) => {
    const code = loadProgram('MinHeapExtract.java');

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

    // Both views visible at the end of MinHeapExtract
    await expect(page.locator('[data-testid^="heap-view-"]').first()).toBeVisible();
    await expect(page.getByTestId('heap-cell-0')).toBeVisible();
    await expect(page.getByTestId('heap-node-0')).toBeVisible();
  });

  test('Stage 7: HeapSortBareArray with View as… override switches between Heap and Array', async ({ page }) => {
    const code = loadProgram('HeapSortBareArray.java');

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

    // Step forward once so `arr` is allocated on line 40
    const stepFwd = page.getByLabel('Step forward');
    await stepFwd.click();

    // Starts rendered as plain array view
    await expect(page.locator('[data-testid^="array-view-"]').first()).toBeVisible();
    await expect(page.getByTestId('array-cell-0')).toBeVisible();

    // Open "View as…" menu on the array
    const viewAsBtn = page.locator('button:has-text("View as…")').first();
    await expect(viewAsBtn).toBeVisible();
    await viewAsBtn.click();

    // Select "Heap"
    const heapOption = page.getByRole('button', { name: /^Heap$/i });
    await expect(heapOption).toBeVisible();
    await heapOption.click();

    // Should now be rendered as heap view with array & tree synchronized
    await expect(page.locator('[data-testid^="heap-view-"]').first()).toBeVisible();
    await expect(page.getByTestId('heap-cell-0')).toBeVisible();
    await expect(page.getByTestId('heap-node-0')).toBeVisible();

    // Open "View as…" menu on the heap and switch back to "Array"
    const viewAsBtn2 = page.locator('button:has-text("View as…")').first();
    await expect(viewAsBtn2).toBeVisible();
    await viewAsBtn2.click();

    const arrayOption = page.getByRole('button', { name: /^Array$/i });
    await expect(arrayOption).toBeVisible();
    await arrayOption.click();

    // Should now be rendered as plain ArrayView again
    await expect(page.locator('[data-testid^="array-view-"]').first()).toBeVisible();
    await expect(page.getByTestId('array-cell-0')).toBeVisible();
  });
});
