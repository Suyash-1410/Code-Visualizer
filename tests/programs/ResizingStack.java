public class ResizingStack {
  int[] data;
  int top;

  public ResizingStack() {
    this.data = new int[2];
    this.top = -1;
  }

  public void push(int val) {
    if (top == data.length - 1) {
      resize();
    }
    data[++top] = val;
  }

  public int pop() {
    if (top == -1) return -1;
    return data[top--];
  }

  private void resize() {
    int[] next = new int[data.length * 2];
    for (int i = 0; i <= top; i++) {
      next[i] = data[i];
    }
    this.data = next;
  }

  public static void main(String[] args) {
    ResizingStack s = new ResizingStack();
    s.push(10);
    s.push(20);
    s.push(30); // triggers resize from 2 to 4
    s.push(40);
    int popped = s.pop();
    System.out.println("popped=" + popped + ", size=" + (s.top + 1) + ", cap=" + s.data.length);
  }
}
