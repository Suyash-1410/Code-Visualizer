import type { ExampleProgram } from './sumOfArray';

export const stackArrayExample: ExampleProgram = {
  id: 'stack-array',
  title: 'Array Stack (Push & Pop)',
  category: 'Stacks, queues, heaps',
  description: 'Fixed-capacity array-backed stack with top pointer tracking push and pop operations.',
  code: `public class Main {
    public static void main(String[] args) {
        ArrayStack stack = new ArrayStack(5);
        stack.push(10);
        stack.push(20);
        stack.push(30);
        int popped = stack.pop();
        stack.push(40);
        System.out.println("Popped: " + popped + ", Top: " + stack.peek());
    }
}

class ArrayStack {
    int[] data;
    int top;

    public ArrayStack(int capacity) {
        this.data = new int[capacity];
        this.top = -1;
    }

    public void push(int val) {
        if (isFull()) return;
        data[++top] = val;
    }

    public int pop() {
        if (isEmpty()) return -1;
        return data[top--];
    }

    public int peek() {
        if (isEmpty()) return -1;
        return data[top];
    }

    public boolean isEmpty() {
        return top == -1;
    }

    public boolean isFull() {
        return top == data.length - 1;
    }
}
`,
};
