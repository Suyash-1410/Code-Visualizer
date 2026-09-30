import java.nio.file.Files;
import java.nio.file.Path;

public class FileAccess {
  public static void main(String[] args) {
    // 1. Write outside /tmp must fail due to --read-only filesystem
    boolean writeOutsideFailed = false;
    try {
      Files.writeString(Path.of("/app/hacked.txt"), "malicious content");
    } catch (Exception e) {
      writeOutsideFailed = true;
      System.out.println("Write outside /tmp failed as expected: " + e.getClass().getSimpleName());
    }

    // 2. Read sensitive environment variable
    String secret = System.getenv("SECRET");

    // 3. Write inside /tmp tmpfs should succeed
    boolean writeTmpSuccess = false;
    try {
      Path tmpFile = Path.of("/tmp/allowed_scratch.txt");
      Files.writeString(tmpFile, "safe");
      writeTmpSuccess = Files.exists(tmpFile);
    } catch (Exception ignored) {
    }

    System.out.println(
        "writeOutsideFailed=" + writeOutsideFailed + ", writeTmpSuccess=" + writeTmpSuccess);
  }
}
