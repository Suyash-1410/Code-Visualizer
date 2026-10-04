public class BracketMatching {
  static class CharStack {
    char[] data;
    int top = -1;

    CharStack(int cap) {
      data = new char[cap];
    }

    void push(char c) {
      data[++top] = c;
    }

    char pop() {
      if (top == -1) return '\0';
      return data[top--];
    }

    boolean isEmpty() {
      return top == -1;
    }
  }

  static boolean isMatching(String s) {
    CharStack stack = new CharStack(s.length());
    for (int i = 0; i < s.length(); i++) {
      char c = s.charAt(i);
      if (c == '(' || c == '[' || c == '{') {
        stack.push(c);
      } else {
        if (stack.isEmpty()) return false;
        char top = stack.pop();
        if ((c == ')' && top != '(') ||
            (c == ']' && top != '[') ||
            (c == '}' && top != '{')) {
          return false;
        }
      }
    }
    return stack.isEmpty();
  }

  public static void main(String[] args) {
    boolean res1 = isMatching("([{}])");
    boolean res2 = isMatching("([)]");
    System.out.println("res1=" + res1 + ", res2=" + res2);
  }
}
