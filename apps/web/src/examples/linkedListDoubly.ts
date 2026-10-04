import type { ExampleProgram } from './sumOfArray';

export const linkedListDoublyExample: ExampleProgram = {
  id: 'linked-list-doubly',
  title: 'Doubly Linked List (Insert & Delete)',
  category: 'Linked lists',
  description: 'Constructs a doubly linked list with next and prev connectors, inserts a node into the middle, and updates two-way links.',
  code: `public class Main {
    public static void main(String[] args) {
        DoublyNode head = new DoublyNode(10);
        DoublyNode tail = new DoublyNode(30);
        head.next = tail;
        tail.prev = head;

        // Insert 20 in the middle between head and tail
        DoublyNode mid = new DoublyNode(20);
        mid.next = head.next;
        mid.prev = head;
        head.next.prev = mid;
        head.next = mid;

        System.out.println("Forward: " + head.val + " -> " + head.next.val + " -> " + head.next.next.val);
    }
}

class DoublyNode {
    int val;
    DoublyNode prev;
    DoublyNode next;

    DoublyNode(int val) {
        this.val = val;
    }
}
`,
};
