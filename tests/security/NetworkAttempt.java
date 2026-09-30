import java.net.InetSocketAddress;
import java.net.Socket;

public class NetworkAttempt {
  public static void main(String[] args) {
    try {
      Socket socket = new Socket();
      socket.connect(new InetSocketAddress("1.1.1.1", 80), 1000);
      System.out.println("Network connected unexpectedly!");
    } catch (Exception e) {
      System.out.println("Network access blocked as expected: " + e.getClass().getSimpleName());
    }
  }
}
