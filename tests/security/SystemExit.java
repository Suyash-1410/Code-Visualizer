public class SystemExit {
  public static void main(String[] args) {
    int x = 10;
    System.out.println("Exiting cleanly via System.exit");
    System.exit(0);
    int y = 20; // never reached
  }
}
