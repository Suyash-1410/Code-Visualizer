import type { ExampleProgram } from './sumOfArray';

export const postfixEvalExample: ExampleProgram = {
  id: 'postfix-eval',
  title: 'Postfix Expression Evaluation',
  category: 'Stacks, queues, heaps',
  description: 'Evaluates reverse Polish notation (postfix) arithmetic using an integer stack.',
  code: `public class Main {
    public static void main(String[] args) {
        String[] tokens = {"5", "3", "+", "2", "*"};
        IntStack stack = new IntStack(tokens.length);

        for (int i = 0; i < tokens.length; i++) {
            String token = tokens[i];
            if (token.equals("+")) {
                int b = stack.pop();
                int a = stack.pop();
                stack.push(a + b);
            } else if (token.equals("*")) {
                int b = stack.pop();
                int a = stack.pop();
                stack.push(a * b);
            } else {
                stack.push(Integer.parseInt(token));
            }
        }

        int result = stack.pop();
        System.out.println("Result = " + result);
    }
}

class IntStack {
    int[] data;
    int top = -1;

    IntStack(int cap) {
        data = new int[cap];
    }

    void push(int val) {
        data[++top] = val;
    }

    int pop() {
        return data[top--];
    }
}
`,
};
