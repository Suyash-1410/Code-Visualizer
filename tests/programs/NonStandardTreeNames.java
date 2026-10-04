public class NonStandardTreeNames {
  public static void main(String[] args) {
    CustomNode root = new CustomNode(10);
    root.leftChild = new CustomNode(5);
    root.rightChild = new CustomNode(15);

    System.out.println("Root: " + root.val + " -> " + root.leftChild.val + ", " + root.rightChild.val);
  }
}

class CustomNode {
  int val;
  CustomNode leftChild;
  CustomNode rightChild;

  CustomNode(int val) {
    this.val = val;
  }
}
