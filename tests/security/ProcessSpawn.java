public class ProcessSpawn {
  public static void main(String[] args) {
    try {
      Process p = Runtime.getRuntime().exec(new String[] {"ls", "/"});
      p.waitFor();
      System.out.println("Process spawned unexpectedly!");
    } catch (Exception e) {
      System.out.println("Process spawn failed as expected: " + e.getClass().getSimpleName());
    }
  }
}
