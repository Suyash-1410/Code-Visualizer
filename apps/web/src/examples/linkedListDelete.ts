import type { ExampleProgram } from './sumOfArray';

export const linkedListDeleteExample: ExampleProgram = {
  id: 'linked-list-delete',
  title: 'Delete a Node',
  category: 'Linked lists',
  description: 'Deletes a node from the middle of a linked list, unlinking it to become an orphaned node.',
  code: `public class Main {
    public static void main(String[] args) {
        Node head = new Node(10);
        head.next = new Node(20);
        head.next.next = new Node(30);

        // Delete middle node (20)
        Node curr = head;
        while (curr.next != null && curr.next.val != 20) {
            curr = curr.next;
        }

        // Bypasses 20 -> points directly to 30
        curr.next = curr.next.next;

        System.out.println("List: " + head.val + " -> " + head.next.val);
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
