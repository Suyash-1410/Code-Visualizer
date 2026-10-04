public class NonStandardNames {
  public static void main(String[] args) {
    AlphaNode a = new AlphaNode(10);
    a.nextNode = new AlphaNode(20);

    BetaNode b = new BetaNode(100);
    b.link = new BetaNode(200);

    System.out.println("Alpha: " + a.data + " -> " + a.nextNode.data);
    System.out.println("Beta: " + b.data + " -> " + b.link.data);
  }
}

class AlphaNode {
  int data;
  AlphaNode nextNode;

  AlphaNode(int data) {
    this.data = data;
  }
}

class BetaNode {
  int data;
  BetaNode link;

  BetaNode(int data) {
    this.data = data;
  }
}
