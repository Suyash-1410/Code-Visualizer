import type { ExampleProgram } from './sumOfArray';

export const stackNodeExample: ExampleProgram = {
  id: 'stack-node',
  title: 'Node Stack (Linked)',
  category: 'Stacks, queues, heaps',
  description: 'Linked-node stack where nodes are chained from the top pointer downward.',
  code: `public class Main {
    public static void main(String[] args) {
        NodeStack stack = new NodeStack();
        stack.push(10);
        stack.push(20);
        stack.push(30);
        int popped = stack.pop();
        stack.push(40);
        System.out.println("Popped: " + popped + ", Top: " + stack.peek() + ", Size: " + stack.size);
    }
}

class NodeStack {
    static class Node {
        int val;
        Node next;
        Node(int val, Node next) {
            this.val = val;
            this.next = next;
        }
    }

    Node top;
    int size;

    public void push(int val) {
        top = new Node(val, top);
        size++;
    }

    public int pop() {
        if (top == null) return -1;
        int v = top.val;
        top = top.next;
        size--;
        return v;
    }

    public int peek() {
        return top != null ? top.val : -1;
    }
}
`,
};
