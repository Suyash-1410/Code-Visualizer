import type { ExampleProgram } from './sumOfArray';

export const bracketMatchingExample: ExampleProgram = {
  id: 'bracket-matching',
  title: 'Bracket Matching',
  category: 'Stacks, queues, heaps',
  description: 'Uses a character stack to validate balanced brackets: (), [], {}.',
  code: `public class Main {
    public static void main(String[] args) {
        boolean valid = isMatching("([{}])");
        boolean invalid = isMatching("([)]");
        System.out.println("valid=" + valid + ", invalid=" + invalid);
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
}

class CharStack {
    char[] data;
    int top = -1;

    CharStack(int cap) {
        data = new char[cap];
    }

    void push(char c) {
        data[++top] = c;
    }

    char pop() {
        if (top == -1) return '\\0';
        return data[top--];
    }

    boolean isEmpty() {
        return top == -1;
    }
}
`,
};
