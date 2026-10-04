import type { ExampleProgram } from './sumOfArray';

export const circularQueueExample: ExampleProgram = {
  id: 'circular-queue',
  title: 'Circular Queue (Wraparound)',
  category: 'Stacks, queues, heaps',
  description: 'Fixed-capacity ring buffer queue with front/rear modulo wraparound and empty/full states.',
  code: `public class Main {
    public static void main(String[] args) {
        CircularQueue q = new CircularQueue(4);
        q.enqueue(10);
        q.enqueue(20);
        q.enqueue(30);
        int d1 = q.dequeue();
        int d2 = q.dequeue();
        q.enqueue(40); // wraps around to index 0
        q.enqueue(50);
        System.out.println("d1=" + d1 + ", d2=" + d2 + ", front=" + q.front + ", rear=" + q.rear);
    }
}

class CircularQueue {
    int[] data;
    int front;
    int rear;

    public CircularQueue(int cap) {
        this.data = new int[cap];
        this.front = 0;
        this.rear = 0;
    }

    public boolean isEmpty() {
        return front == rear;
    }

    public boolean isFull() {
        return (rear + 1) % data.length == front;
    }

    public void enqueue(int val) {
        if (isFull()) return;
        data[rear] = val;
        rear = (rear + 1) % data.length;
    }

    public int dequeue() {
        if (isEmpty()) return -1;
        int v = data[front];
        front = (front + 1) % data.length;
        return v;
    }
}
`,
};
