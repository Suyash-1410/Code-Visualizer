public class ReferenceAliasing {
  public static void main(String[] args) {
    Box b1 = new Box(100);
    Box b2 = b1;
    b2.value = 200;
  }
}

class Box {
  int value;

  Box(int value) {
    this.value = value;
  }
}
