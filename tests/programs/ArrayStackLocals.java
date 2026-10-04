public class ArrayStackLocals {
  public static void main(String[] args) {
    int[] stack = new int[5];
    int top = -1;

    // push 10, 20, 30
    stack[++top] = 10;
    stack[++top] = 20;
    stack[++top] = 30;

    // pop
    int popped = stack[top--];

    // push 40
    stack[++top] = 40;

    System.out.println("popped=" + popped + ", topIdx=" + top + ", topVal=" + stack[top]);
  }
}
