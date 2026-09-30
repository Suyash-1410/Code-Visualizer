public class CustomException {
  public static void main(String[] args) throws MyException {
    throw new MyException("Something failed");
  }
}

class MyException extends Exception {
  MyException(String message) {
    super(message);
  }
}
