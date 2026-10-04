public class ArrayStack {
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

  public static void main(String[] args) {
    ArrayStack s = new ArrayStack(5);
    s.push(10);
    s.push(20);
    s.push(30);
    int popped = s.pop();
    s.push(40);
    int topVal = s.peek();
    System.out.println("popped=" + popped + ", top=" + topVal + ", size=" + (s.top + 1));
  }
}
