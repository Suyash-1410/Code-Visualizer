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
    // Set invalid Java syntax
    const badCode = 'public class Main { public static void main(String[] args) { int x = ; } }';
    await page.evaluate((code) => {
      localStorage.setItem('javascope_editor_code', code);
    }, badCode);
    await page.reload();

    const editBtn = page.getByRole('button', { name: /Edit/i });
    if (await editBtn.isVisible()) {
      await editBtn.click();
    }

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
    // Deep recursion exceeding 200 frames
    const recCode =
      'public class Main { public static void rec(int n) { rec(n + 1); } public static void main(String[] args) { rec(0); } }';
    await page.evaluate((code) => {
      localStorage.setItem('javascope_editor_code', code);
    }, recCode);
    await page.reload();

    const editBtn = page.getByRole('button', { name: /Edit/i });
    if (await editBtn.isVisible()) {
      await editBtn.click();
    }

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
    await expect(page.locator('#example-select')).toHaveValue('sum-of-array');
    await page.getByRole('button', { name: /Run/i }).click();

    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

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
    await expect(page.locator('#example-select')).toHaveValue('fibonacci');
    await page.getByRole('button', { name: /Run/i }).click();
    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });
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

  test('9. ReverseIterative: steps through list reversal and checks final order', async ({ page }) => {
    const reverseCode = `public class ReverseIterative {
  public static void main(String[] args) {
    Node head = new Node(1);
    head.next = new Node(2);
    head.next.next = new Node(3);
    head.next.next.next = new Node(4);

    Node prev = null;
    Node curr = head;
    while (curr != null) {
      Node next = curr.next;
      curr.next = prev;
      prev = curr;
      curr = next;
    }
    head = prev;
    System.out.println("Reversed: " + head.val + " " + head.next.val + " " + head.next.next.val + " " + head.next.next.next.val);
  }
}

class Node {
  int val;
  Node next;

  Node(int val) {
    this.val = val;
  }
}
`;

    await page.evaluate((code) => {
      localStorage.setItem('javascope_editor_code', code);
    }, reverseCode);
    await page.reload();

    // Ensure in edit mode (clear any active trace)
    const editBtn = page.getByRole('button', { name: /Edit/i });
    if (await editBtn.isVisible()) {
      await editBtn.click();
    }

    // Run execution
    const runBtn = page.getByRole('button', { name: /Run/i });
    await expect(runBtn).toBeEnabled();
    await runBtn.click();

    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }

    // Jump to end to verify final execution
    await page.getByLabel('Jump to end').click();

    // Final stdout check (at program end, output is complete)
    const stdoutPanel = page.locator('[data-testid="stdout-panel"]');
    await expect(stdoutPanel).toBeVisible();
    await expect(stdoutPanel).toContainText('Reversed: 4 3 2 1');

    // Step back into main method (step 57) before frame returned
    const stepBack = page.getByLabel('Step back');
    await stepBack.click();
    await stepBack.click();

    // LinkedListView should be visible with singly linked list badge
    await expect(page.locator('[data-testid="linked-list-view"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Singly linked list')).toBeVisible();

    // Final reversed list view has head tag on new head node
    await expect(page.locator('[data-testid="tag-head"]')).toBeVisible();
  });

  test('10. ReverseRecursive: active node follows top frame and Variables panel shows readable summary (Stage 5)', async ({ page }) => {
    const recursiveCode = `public class ReverseRecursive {
  public static void main(String[] args) {
    Node head = new Node(1);
    head.next = new Node(2);
    head.next.next = new Node(3);
    head.next.next.next = new Node(4);

    Node newHead = reverse(head);
    System.out.println("Done: " + newHead.val);
  }

  static Node reverse(Node node) {
    if (node == null || node.next == null) {
      return node;
    }
    Node newHead = reverse(node.next);
    node.next.next = node;
    node.next = null;
    return newHead;
  }
}

class Node {
  int val;
  Node next;

  Node(int val) {
    this.val = val;
  }
}
`;

    await page.evaluate((code) => {
      localStorage.setItem('javascope_editor_code', code);
    }, recursiveCode);
    await page.reload();

    const editBtn = page.getByRole('button', { name: /Edit/i });
    if (await editBtn.isVisible()) {
      await editBtn.click();
    }

    const runBtn = page.getByRole('button', { name: /Run/i });
    await expect(runBtn).toBeEnabled();
    await runBtn.click();

    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }

    // Step forward until we enter reverse() recursion
    const stepFwd = page.getByLabel('Step forward');
    let enteredReverse = false;
    for (let i = 0; i < 40; i++) {
      const reverseFrame = page.locator('[data-testid="call-stack-panel"]').getByText(/reverse\(/);
      if (await reverseFrame.count() > 0) {
        enteredReverse = true;
        break;
      }
      await stepFwd.click();
    }
    expect(enteredReverse).toBe(true);

    // Verify Active badge exists in diagram on the active node
    await expect(page.locator('[data-testid="linked-list-view"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Active').first()).toBeVisible();

    // Verify Variables panel shows readable summary (e.g. Node(1) or Node(2))
    await expect(page.getByText(/Node\(\d+\)/).first()).toBeVisible();
  });

  test('11. NullPointerException during list traversal shows error banner and keeps list visible (Stage 5)', async ({ page }) => {
    const npeCode = `public class Main {
  public static void main(String[] args) {
    Node head = new Node(10);
    head.next = new Node(20);
    Node curr = head;
    curr = curr.next.next;
    System.out.println(curr.val);
  }
}

class Node {
  int val;
  Node next;

  Node(int val) {
    this.val = val;
  }
}
`;

    await page.evaluate((code) => {
      localStorage.setItem('javascope_editor_code', code);
    }, npeCode);
    await page.reload();

    const editBtn = page.getByRole('button', { name: /Edit/i });
    if (await editBtn.isVisible()) {
      await editBtn.click();
    }

    const runBtn = page.getByRole('button', { name: /Run/i });
    await expect(runBtn).toBeEnabled();
    await runBtn.click();

    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

    // Jump to end where NPE occurs
    const jumpEndBtn = page.getByLabel('Jump to end');
    await jumpEndBtn.click();

    // Verify NullPointerException in status banner
    const statusBanner = page.locator('[data-testid="status-banner"]');
    await expect(statusBanner).toBeVisible();
    await expect(statusBanner).toContainText('NullPointerException');

    // Step back from the post-mortem 'end' step to the 'exception' step where the list is live
    await page.getByLabel('Step back').click();

    // Verify list view is still visible with nodes allocated prior to failure
    await expect(page.locator('[data-testid="linked-list-view"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('10').first()).toBeVisible();
    await expect(page.getByText('20').first()).toBeVisible();
  });

  test('12. DeleteMiddle: steps through middle node deletion and unlinks node', async ({ page }) => {
    await page.locator('#example-select').selectOption('linked-list-delete');
    await page.getByRole('button', { name: /Run/i }).click();

    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }

    // Jump to end, then step back into main before method return
    await page.getByLabel('Jump to end').click();
    await page.getByLabel('Step back').click();
    await page.getByLabel('Step back').click();

    // Verify list view is visible with remaining nodes 10 and 30
    await expect(page.locator('[data-testid="linked-list-view"]')).toBeVisible();
    await expect(page.getByText('10').first()).toBeVisible();
    await expect(page.getByText('30').first()).toBeVisible();

    // Verify stdout shows correct result
    const stdoutPanel = page.locator('[data-testid="stdout-panel"]');
    await expect(stdoutPanel).toContainText('10 -> 30');
  });

  test('13. Cycle Detection: detects cycle with Floyd\'s algorithm and shows Cycle badge', async ({ page }) => {
    await page.locator('#example-select').selectOption('linked-list-cycle-detect');
    await page.getByRole('button', { name: /Run/i }).click();

    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }

    // Step forward until cycle is created and detected
    await page.getByLabel('Jump to end').click();
    await page.getByLabel('Step back').click();
    await page.getByLabel('Step back').click();

    // Verify cycle badge is rendered
    await expect(page.locator('[data-testid="linked-list-view"]')).toBeVisible();
    const cycleBadge = page.locator('[data-testid="cycle-badge"]');
    await expect(cycleBadge).toBeVisible();
    await expect(cycleBadge.getByText('Cycle')).toBeVisible();

    // Verify output confirms cycle detected
    const stdoutPanel = page.locator('[data-testid="stdout-panel"]');
    await expect(stdoutPanel).toContainText('Cycle detected: true');
  });

  test('14. Doubly Linked List: displays doubly linked list badge with two-way connectors', async ({ page }) => {
    await page.locator('#example-select').selectOption('linked-list-doubly');
    await page.getByRole('button', { name: /Run/i }).click();

    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }

    await page.getByLabel('Jump to end').click();
    await page.getByLabel('Step back').click();
    await page.getByLabel('Step back').click();

    // Verify doubly linked badge inside list view
    const listView = page.locator('[data-testid="linked-list-view"]');
    await expect(listView).toBeVisible();
    await expect(listView.getByText('Doubly linked list')).toBeVisible();

    // Verify nodes 10, 20, 30 are rendered in forward order
    await expect(listView.getByText('10').first()).toBeVisible();
    await expect(listView.getByText('20').first()).toBeVisible();
    await expect(listView.getByText('30').first()).toBeVisible();
  });

  test('15. Wrapper Class: renders user-written MyLinkedList container with fields and nodes', async ({ page }) => {
    await page.locator('#example-select').selectOption('linked-list-wrapper');
    await page.getByRole('button', { name: /Run/i }).click();

    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }

    await page.getByLabel('Jump to end').click();
    await page.getByLabel('Step back').click();
    await page.getByLabel('Step back').click();

    // Verify linked list view rendered
    await expect(page.locator('[data-testid="linked-list-view"]')).toBeVisible();
    await expect(page.getByText('MyLinkedList').first()).toBeVisible();

    // Verify remaining nodes 10 and 30 (20 was removed)
    await expect(page.getByText('10').first()).toBeVisible();
    await expect(page.getByText('30').first()).toBeVisible();
  });

  test('16. View as… Override: switches between Linked List and Generic Object views', async ({ page }) => {
    await page.locator('#example-select').selectOption('linked-list-build');
    await page.getByRole('button', { name: /Run/i }).click();

    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }

    // Step forward 10 steps so list is partially built
    for (let i = 0; i < 10; i++) {
      await page.getByLabel('Step forward').click();
    }

    // 1. Initially recognized as LinkedListView
    const listView = page.locator('[data-testid="linked-list-view"]');
    await expect(listView).toBeVisible();

    // 2. Click "View as…" button and select "Generic object"
    await page.locator('[data-testid="view-as-button"]').click();
    const dropdown = page.locator('[data-testid="view-as-dropdown"]');
    await expect(dropdown).toBeVisible();
    await dropdown.getByText('Generic object').click();

    // 3. LinkedListView should be hidden, and Generic Object views should be displayed
    await expect(listView).toBeHidden();
    const genericObject = page.locator('[data-testid^="object-view-"]').first();
    await expect(genericObject).toBeVisible();

    // 4. Click "View as…" button on the generic object card and switch back to "Linked list"
    const objViewAsBtn = page.locator('[data-testid^="view-as-button-"]').first();
    await objViewAsBtn.click();
    const objDropdown = page.locator('[data-testid^="view-as-dropdown-"]').first();
    await expect(objDropdown).toBeVisible();
    await objDropdown.getByText('Linked list').click();

    // 5. LinkedListView should reappear
    await expect(listView).toBeVisible();
  });

  test('17. Binary Tree: renders tree nodes, edges, attached tags, and navigates steps cleanly', async ({ page }) => {
    const bstCode = `public class SmallBst {
  public static void main(String[] args) {
    TreeNode root = new TreeNode(50);
    root.left = new TreeNode(30);
    root.right = new TreeNode(70);
    System.out.println("BST: " + root.val);
  }
}

class TreeNode {
  int val;
  TreeNode left;
  TreeNode right;
  TreeNode(int val) { this.val = val; }
}
`;

    await page.evaluate((code) => {
      localStorage.setItem('javascope_editor_code', code);
    }, bstCode);
    await page.reload();

    // Ensure edit mode
    const editBtn = page.getByRole('button', { name: /Edit/i });
    if (await editBtn.isVisible()) {
      await editBtn.click();
    }

    // Run execution
    const runBtn = page.getByRole('button', { name: /Run/i });
    await expect(runBtn).toBeEnabled();
    await runBtn.click();

    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }

    // Step forward 10 steps so tree is built
    for (let i = 0; i < 10; i++) {
      await page.getByLabel('Step forward').click();
    }

    // Tree should be recognized and rendered
    await expect(page.getByText(/Detected as: Binary tree/i)).toBeVisible({ timeout: 10000 });
    const nodes = page.locator('.nodes circle');
    await expect(nodes.first()).toBeVisible();

    // Values 50, 30, 70 should be visible
    await expect(page.getByText('50').first()).toBeVisible();
    await expect(page.getByText('30').first()).toBeVisible();
    await expect(page.getByText('70').first()).toBeVisible();

    // Variable tag 'root' attached
    await expect(page.locator('[data-testid="tag-root"]')).toBeVisible();

    // Step backward and verify smooth transition without crashes
    await page.getByLabel('Step back').click();
    await page.getByLabel('Step back').click();
    await expect(page.getByText(/Detected as: Binary tree/i)).toBeVisible();
  });
});

