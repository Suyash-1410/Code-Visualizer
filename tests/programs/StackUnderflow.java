class StackUnderflowException extends RuntimeException {
  public StackUnderflowException(String msg) {
    super(msg);
  }
}

public class StackUnderflow {
  static class SimpleStack {
    int[] data = new int[5];
    int top = -1;

    public int pop() {
      if (top == -1) {
        throw new StackUnderflowException("Stack underflow");
      }
      return data[top--];
    }
  }

  public static void main(String[] args) {
    SimpleStack s = new SimpleStack();
    s.pop();
  }
}
