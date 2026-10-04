import type { ExampleProgram } from './sumOfArray';

export const linkedListBuildExample: ExampleProgram = {
  id: 'linked-list-build',
  title: 'Build and Traverse',
  category: 'Linked lists',
  description: 'Constructs a 4-node singly linked list by appending at the tail, then traverses it.',
  code: `public class Main {
    public static void main(String[] args) {
        Node head = new Node(10);
        Node tail = head;

        for (int v = 20; v <= 40; v += 10) {
            tail.next = new Node(v);
            tail = tail.next;
        }

        Node curr = head;
        while (curr != null) {
            System.out.println("Node: " + curr.val);
            curr = curr.next;
        }
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
