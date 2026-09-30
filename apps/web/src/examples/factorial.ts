import type { ExampleProgram } from './sumOfArray';

export const factorialExample: ExampleProgram = {
  id: 'factorial',
  title: 'Factorial(5)',
  category: 'Recursion',
  description: 'Computes 5! recursively, showing the call stack grow to depth 5 and unwind with return values.',
  code: `public class Main {
    public static int fact(int n) {
        if (n <= 1) {
            return 1;
        }
        return n * fact(n - 1);
    }

    public static void main(String[] args) {
        int result = fact(5);
        System.out.println("5! = " + result);
    }
}
`,
};
