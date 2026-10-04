public class NonStandardTreeLR {
  public static void main(String[] args) {
    ShortNode root = new ShortNode(100);
    root.l = new ShortNode(50);
    root.r = new ShortNode(150);

    System.out.println("Root: " + root.data + " -> " + root.l.data + ", " + root.r.data);
  }
}

class ShortNode {
  int data;
  ShortNode l;
  ShortNode r;

  ShortNode(int data) {
    this.data = data;
  }
}
