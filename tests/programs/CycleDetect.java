public class CycleDetect {
  public static void main(String[] args) {
    Node head = new Node(1);
    head.next = new Node(2);
    head.next.next = new Node(3);
    head.next.next.next = new Node(4);
    head.next.next.next.next = new Node(5);
    // Cycle: 5 -> 3
    head.next.next.next.next.next = head.next.next;

    Node slow = head;
    Node fast = head;
    boolean hasCycle = false;
    while (fast != null && fast.next != null) {
      slow = slow.next;
      fast = fast.next.next;
      if (slow == fast) {
        hasCycle = true;
        break;
      }
    }

    System.out.println("Cycle detected: " + hasCycle);
  }
}

class Node {
  int val;
  Node next;

  Node(int val) {
    this.val = val;
  }
}
