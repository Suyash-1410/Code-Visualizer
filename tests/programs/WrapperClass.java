public class WrapperClass {
  public static void main(String[] args) {
    MyLinkedList list = new MyLinkedList();
    list.add(10);
    list.add(20);
    list.add(30);
    list.remove(20);
    System.out.println("Size: " + list.size + ", Head: " + list.head.val + ", Next: " + list.head.next.val);
  }
}

class MyLinkedList {
  Node head;
  int size;

  void add(int val) {
    Node newNode = new Node(val);
    if (head == null) {
      head = newNode;
    } else {
      Node curr = head;
      while (curr.next != null) {
        curr = curr.next;
      }
      curr.next = newNode;
    }
    size++;
  }

  void remove(int val) {
    if (head == null) {
      return;
    }
    if (head.val == val) {
      head = head.next;
      size--;
      return;
    }
    Node curr = head;
    while (curr.next != null && curr.next.val != val) {
      curr = curr.next;
    }
    if (curr.next != null) {
      curr.next = curr.next.next;
      size--;
    }
  }
}

class Node {
  int val;
  Node next;

  Node(int val) {
    this.val = val;
  }
}
