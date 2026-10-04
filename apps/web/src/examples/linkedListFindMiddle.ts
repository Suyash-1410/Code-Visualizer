import type { ExampleProgram } from './sumOfArray';

export const linkedListFindMiddleExample: ExampleProgram = {
  id: 'linked-list-find-middle',
  title: 'Find Middle (Slow & Fast)',
  category: 'Linked lists',
  description: 'Finds the middle node of a 5-node linked list in a single pass using slow and fast runner pointers.',
  code: `public class Main {
    public static void main(String[] args) {
        Node head = new Node(1);
        head.next = new Node(2);
        head.next.next = new Node(3);
        head.next.next.next = new Node(4);
        head.next.next.next.next = new Node(5);

        Node slow = head;
        Node fast = head;

        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
        }

        System.out.println("Middle node: " + slow.val);
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
