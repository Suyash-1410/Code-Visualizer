import { test, expect } from '@playwright/test';

test.describe('JavaScope Phase 3: Binary Tree Visualization E2E Suite (PRD 4.7, 5, 6, 12.4)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('1. BST insert of 7 nodes: verifies tidy tree layout, left/right order, and tags', async ({ page }) => {
    await page.locator('#example-select').selectOption('bst-insert');
    await page.getByRole('button', { name: /Run/i }).click();

    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }

    // Jump to end then step back 1 to stay inside main where root is on the stack
    await page.getByLabel('Jump to end').click();
    await page.getByLabel('Step back').click();

    // Verify tree recognition
    await expect(page.getByText(/Detected as: Binary tree/i)).toBeVisible({ timeout: 10000 });

    // Verify nodes 50, 30, 70, 20, 40, 60, 80 are rendered
    for (const val of [50, 30, 70, 20, 40, 60, 80]) {
      await expect(page.getByText(String(val)).first()).toBeVisible();
    }

    // Verify root tag is present
    await expect(page.locator('[data-testid="tag-root"]')).toBeVisible();

    // Verify left/right spatial positioning: 30 must be to the left of 50, 70 to the right of 50
    const node50 = page.locator('g[data-testid^="node-"]').filter({ hasText: '50' }).first();
    const node30 = page.locator('g[data-testid^="node-"]').filter({ hasText: '30' }).first();
    const node70 = page.locator('g[data-testid^="node-"]').filter({ hasText: '70' }).first();

    const box50 = await node50.boundingBox();
    const box30 = await node30.boundingBox();
    const box70 = await node70.boundingBox();

    expect(box50).not.toBeNull();
    expect(box30).not.toBeNull();
    expect(box70).not.toBeNull();

    expect(box30!.x).toBeLessThan(box50!.x);
    expect(box70!.x).toBeGreaterThan(box50!.x);
    expect(box30!.y).toBeGreaterThan(box50!.y);
  });

  test('2. Traversals: verifies call stack, progress states, and output tokens', async ({ page }) => {
    await page.locator('#example-select').selectOption('inorder-traversal');
    await page.getByRole('button', { name: /Run/i }).click();

    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }

    // Jump scrubber into recursion (around step 55-60)
    await page.getByLabel('Timeline scrubber').fill('58');

    // Verify call stack has active inorder frame
    const callStack = page.locator('[data-testid="call-stack-panel"]');
    await expect(callStack).toBeVisible();
    await expect(callStack.getByText(/inorder/i).first()).toBeVisible();

    // Jump to end then step back 1 to stay inside main
    await page.getByLabel('Jump to end').click();
    await page.getByLabel('Step back').click();

    // Verify stdout contains in-order traversal
    const stdoutPanel = page.locator('[data-testid="stdout-panel"]');
    await expect(stdoutPanel).toBeVisible();
    await expect(stdoutPanel).toContainText('1 2 3 4 5 6 7');

    // Output order strip should display tokens
    const strip = page.locator('[data-testid="output-order-strip"]');
    await expect(strip).toBeVisible();
  });

  test('3. Delete with two children: successor replacement and tree restructuring', async ({ page }) => {
    await page.locator('#example-select').selectOption('bst-delete');
    await page.getByRole('button', { name: /Run/i }).click();

    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }

    // Jump to end then step back 1
    await page.getByLabel('Jump to end').click();
    await page.getByLabel('Step back').click();

    // Verify tree is recognized and displayed
    await expect(page.getByText(/Detected as: Binary tree/i)).toBeVisible();

    // Root 50 was replaced by successor 60; deleted nodes 20, 30 are gone
    await expect(page.getByText('60').first()).toBeVisible();
    await expect(page.getByText('40').first()).toBeVisible();
    await expect(page.getByText('70').first()).toBeVisible();
    await expect(page.getByText('80').first()).toBeVisible();
  });

  test('4. AVL rotation: tree structure rewiring and root update', async ({ page }) => {
    await page.locator('#example-select').selectOption('avl-rotation');
    await page.getByRole('button', { name: /Run/i }).click();

    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }

    // Jump to end then step back 1
    await page.getByLabel('Jump to end').click();
    await page.getByLabel('Step back').click();

    // New root is 20 with left child 10 and right child 30
    await expect(page.getByText(/Detected as: Binary tree/i)).toBeVisible();
    const node20 = page.locator('g[data-testid^="node-"]').filter({ hasText: '20' }).first();
    const node10 = page.locator('g[data-testid^="node-"]').filter({ hasText: '10' }).first();
    const node30 = page.locator('g[data-testid^="node-"]').filter({ hasText: '30' }).first();

    const box20 = await node20.boundingBox();
    const box10 = await node10.boundingBox();
    const box30 = await node30.boundingBox();

    expect(box20).not.toBeNull();
    expect(box10).not.toBeNull();
    expect(box30).not.toBeNull();

    expect(box20!.y).toBeLessThan(box10!.y);
    expect(box20!.y).toBeLessThan(box30!.y);
    expect(box10!.x).toBeLessThan(box20!.x);
    expect(box30!.x).toBeGreaterThan(box20!.x);
  });

  test('5. Wrapper class: container class holding root and size fields', async ({ page }) => {
    await page.locator('#example-select').selectOption('wrapper-bst');
    await page.getByRole('button', { name: /Run/i }).click();

    await expect(page.getByLabel('Timeline scrubber')).toBeVisible({ timeout: 25000 });

    const pauseBtn = page.getByLabel('Pause');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }

    // Jump to end then step back 1
    await page.getByLabel('Jump to end').click();
    await page.getByLabel('Step back').click();

    // Tree should be recognized with wrapper information
    await expect(page.getByText(/Detected as: Binary tree/i)).toBeVisible();
    await expect(page.locator('.wrapper-header')).toBeVisible();
    await expect(page.getByText('size: 3').first()).toBeVisible();
    await expect(page.getByText('50').first()).toBeVisible();
    await expect(page.getByText('30').first()).toBeVisible();
    await expect(page.getByText('70').first()).toBeVisible();
  });

  test('6. LeftOnly placement: lone left child is strictly to the left of parent', async ({ page }) => {
    const leftOnlyCode = `public class Main {
    public static void main(String[] args) {
        TreeNode root = new TreeNode(10);
        root.left = new TreeNode(5);
        System.out.println(root.val);
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
    }, leftOnlyCode);
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

    // Jump to end then step back 1
    await page.getByLabel('Jump to end').click();
    await page.getByLabel('Step back').click();

    const node10 = page.locator('g[data-testid^="node-"]').filter({ hasText: '10' }).first();
    const node5 = page.locator('g[data-testid^="node-"]').filter({ hasText: '5' }).first();

    const box10 = await node10.boundingBox();
    const box5 = await node5.boundingBox();

    expect(box10).not.toBeNull();
    expect(box5).not.toBeNull();

    // Key PRD Requirement: Lone left child must NOT be centered; it must be strictly to the left!
    expect(box5!.x).toBeLessThan(box10!.x - 10);
  });

  test('7. NullPointerException case: highlights runtime exception cleanly during tree traversal', async ({ page }) => {
    const npeCode = `public class Main {
    public static void main(String[] args) {
        TreeNode root = new TreeNode(10);
        traverse(root);
    }
    static void traverse(TreeNode node) {
        int v = node.left.val; // Throws NullPointerException
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
    }, npeCode);
    await page.reload();

    const editBtn = page.getByRole('button', { name: /Edit/i });
    if (await editBtn.isVisible()) {
      await editBtn.click();
    }

    await page.getByRole('button', { name: /Run/i }).click();

    const banner = page.locator('[data-testid="status-banner"]');
    await expect(banner).toBeVisible({ timeout: 25000 });
    await expect(banner).toContainText('NullPointerException');

    // Scrubber remains functional
    await expect(page.getByLabel('Timeline scrubber')).toBeVisible();
    await page.getByLabel('Step back').click();
    await expect(page.getByText(/Step \d+ of \d+/)).toBeVisible();
  });

  test('8. View as… override: switches LeftRightAsList between Tree and Doubly Linked List', async ({ page }) => {
    const listTreeCode = `public class Main {
    public static void main(String[] args) {
        Node a = new Node(1);
        Node b = new Node(2);
        a.right = b;
        b.left = a;
        System.out.println("Linked");
    }
}
class Node {
    int val;
    Node left;
    Node right;
    Node(int val) { this.val = val; }
}
`;

    await page.evaluate((code) => {
      localStorage.setItem('javascope_editor_code', code);
    }, listTreeCode);
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

    // Jump to end then step back 1
    await page.getByLabel('Jump to end').click();
    await page.getByLabel('Step back').click();

    // 1. By default, classes with left/right are detected as Binary Tree
    await expect(page.getByText(/Detected as: Binary tree/i)).toBeVisible();

    // 2. Click "View as…" button and switch to Doubly linked list
    await page.locator('[data-testid="view-as-button"]').click();
    const dropdown = page.locator('[data-testid="view-as-dropdown"]');
    await expect(dropdown).toBeVisible();
    await dropdown.getByText('Doubly linked list').click();

    // 3. TreeView should be hidden and LinkedListView should be visible
    await expect(page.locator('[data-testid="linked-list-view"]')).toBeVisible();

    // 4. Switch back to Binary tree
    await page.locator('[data-testid="view-as-button"]').click();
    const dropdown2 = page.locator('[data-testid="view-as-dropdown"]');
    await expect(dropdown2).toBeVisible();
    await dropdown2.getByText('Binary tree').click();

    // 5. Binary tree view reappears
    await expect(page.getByText(/Detected as: Binary tree/i)).toBeVisible();
  });

  test('9. ThreeChildFields: classes with three self-typed fields stay in generic ObjectView', async ({ page }) => {
    const threeChildCode = `public class Main {
    public static void main(String[] args) {
        TriNode root = new TriNode(1);
        root.left = new TriNode(2);
        root.mid = new TriNode(3);
        root.right = new TriNode(4);
        System.out.println("TriTree");
    }
}
class TriNode {
    int val;
    TriNode left;
    TriNode mid;
    TriNode right;
    TriNode(int val) { this.val = val; }
}
`;

    await page.evaluate((code) => {
      localStorage.setItem('javascope_editor_code', code);
    }, threeChildCode);
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

    // Jump to end then step back 1
    await page.getByLabel('Jump to end').click();
    await page.getByLabel('Step back').click();

    // Must NOT be detected as Binary Tree or Linked List (PRD Section 6)
    await expect(page.getByText(/Detected as: Binary tree/i)).toBeHidden();
    await expect(page.locator('[data-testid="linked-list-view"]')).toBeHidden();

    // Renders honestly as generic object view cards
    const genericObjects = page.locator('[data-testid^="object-view-"]');
    await expect(genericObjects.first()).toBeVisible();
  });

  test('10. Cycle warning: cyclic tree back-edge terminates and shows warning badge', async ({ page }) => {
    const cycleCode = `public class Main {
    public static void main(String[] args) {
        TreeNode root = new TreeNode(1);
        root.left = new TreeNode(2);
        root.left.right = root; // cycle back to root!
        System.out.println("Cycle");
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
    }, cycleCode);
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

    // Jump to end then step back 1
    await page.getByLabel('Jump to end').click();
    await page.getByLabel('Step back').click();

    // Warning badge displayed: Cycle detected (invalid tree)
    await expect(page.getByText(/Cycle detected/i)).toBeVisible();
  });
});
