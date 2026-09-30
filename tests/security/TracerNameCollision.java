public class TracerNameCollision {
  public static void main(String[] args) {
    WrapperLauncher wl = new WrapperLauncher(42);
    HeapSnapshotBuilder hsb = new HeapSnapshotBuilder("collision");
    System.out.println("User class collision handled: " + wl.val + ", " + hsb.tag);
  }

  static class WrapperLauncher {
    int val;

    WrapperLauncher(int val) {
      this.val = val;
    }
  }

  static class HeapSnapshotBuilder {
    String tag;

    HeapSnapshotBuilder(String tag) {
      this.tag = tag;
    }
  }
}
