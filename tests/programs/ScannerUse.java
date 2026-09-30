import java.util.Scanner;

public class ScannerUse {
  public static void main(String[] args) {
    Scanner sc = new Scanner(System.in);
    boolean has = sc.hasNext();
    System.out.println("has=" + has);
  }
}
