public class MergeTwoSorted {
  public static void main(String[] args) {
    Node l1 = new Node(1);
    l1.next = new Node(3);
    l1.next.next = new Node(5);

    Node l2 = new Node(2);
    l2.next = new Node(4);
    l2.next.next = new Node(6);

    Node dummy = new Node(0);
    Node tail = dummy;

    Node p1 = l1;
    Node p2 = l2;
    while (p1 != null && p2 != null) {
      if (p1.val <= p2.val) {
        tail.next = p1;
        p1 = p1.next;
      } else {
        tail.next = p2;
        p2 = p2.next;
      }
      tail = tail.next;
    }
    if (p1 != null) {
      tail.next = p1;
    }
    if (p2 != null) {
      tail.next = p2;
    }

    Node head = dummy.next;
    System.out.println("Merged: " + head.val + " " + head.next.val + " " + head.next.next.val + " " + head.next.next.next.val + " " + head.next.next.next.next.val + " " + head.next.next.next.next.next.val);
  }
}

class Node {
  int val;
  Node next;

  Node(int val) {
    this.val = val;
  }
}
