import type { ExampleProgram } from './sumOfArray';

export const linkedListCycleDetectExample: ExampleProgram = {
  id: 'linked-list-cycle-detect',
  title: 'Detect a Cycle (Floyd\'s)',
  category: 'Linked lists',
  description: 'Creates a 5-node list with a cycle (5 -> 3), detects it with Floyd\'s cycle-finding algorithm, and displays the Cycle badge.',
  code: `public class Main {
    public static void main(String[] args) {
        Node head = new Node(1);
        head.next = new Node(2);
        head.next.next = new Node(3);
        head.next.next.next = new Node(4);
        head.next.next.next.next = new Node(5);

        // Create cycle from 5 back to 3
        head.next.next.next.next.next = head.next.next;

        Node slow = head;
        Node fast = head;
        boolean hasCycle = false;

        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;

            if (slow == fast) {
                hasCycle = true;
                break;
            }
        }

        System.out.println("Cycle detected: " + hasCycle);
    }
}

class Node {
    int val;
    Node next;

    Node(int val) {
        this.val = val;
    }
}
`,
};
