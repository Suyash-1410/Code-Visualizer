public class QueueFromTwoStacks {
  static class SimpleStack {
    int[] data;
    int top = -1;

    SimpleStack(int cap) {
      data = new int[cap];
    }

    void push(int val) {
      data[++top] = val;
    }

    int pop() {
      return data[top--];
    }

    boolean isEmpty() {
      return top == -1;
    }
  }

  SimpleStack inStack;
  SimpleStack outStack;

  public QueueFromTwoStacks(int cap) {
    inStack = new SimpleStack(cap);
    outStack = new SimpleStack(cap);
  }

  public void enqueue(int val) {
    inStack.push(val);
  }

  public int dequeue() {
    if (outStack.isEmpty()) {
      while (!inStack.isEmpty()) {
        outStack.push(inStack.pop());
      }
    }
    return outStack.pop();
  }

  public static void main(String[] args) {
    QueueFromTwoStacks q = new QueueFromTwoStacks(5);
    q.enqueue(10);
    q.enqueue(20);
    q.enqueue(30);
    int d1 = q.dequeue(); // 10
    q.enqueue(40);
    int d2 = q.dequeue(); // 20
    int d3 = q.dequeue(); // 30
    int d4 = q.dequeue(); // 40
    System.out.println("d=" + d1 + "," + d2 + "," + d3 + "," + d4);
  }
}
