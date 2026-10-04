class StackOverflowException extends RuntimeException {
  public StackOverflowException(String msg) {
    super(msg);
  }
}

public class StackOverflow {
  static class SimpleStack {
    int[] data = new int[2];
    int top = -1;

    public void push(int val) {
      if (top == data.length - 1) {
        throw new StackOverflowException("Stack overflow");
      }
      data[++top] = val;
    }
  }

  public static void main(String[] args) {
    SimpleStack s = new SimpleStack();
    s.push(1);
    s.push(2);
    s.push(3);
  }
}
