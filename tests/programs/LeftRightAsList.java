public class LeftRightAsList {
  public static void main(String[] args) {
    ListNode n1 = new ListNode(1);
    ListNode n2 = new ListNode(2);
    ListNode n3 = new ListNode(3);

    // left = prev, right = next
    n1.right = n2;
    n2.left = n1;
    n2.right = n3;
    n3.left = n2;

    System.out.println("List: " + n1.val + " <-> " + n2.val + " <-> " + n3.val);
  }
}

class ListNode {
  int val;
  ListNode left;
  ListNode right;

  ListNode(int val) {
    this.val = val;
  }
}
