public class OutputFlood {
  public static void main(String[] args) {
    String chunk = "0123456789".repeat(500); // 5000 chars
    for (int i = 0; i < 20; i++) {
      System.out.println(chunk);
    }
  }
}
