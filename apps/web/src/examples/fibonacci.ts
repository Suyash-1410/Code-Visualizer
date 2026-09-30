import type { ExampleProgram } from './sumOfArray';

export const fibonacciExample: ExampleProgram = {
  id: 'fibonacci',
  title: 'Fibonacci(5) Recursive',
  category: 'Recursion',
  description: 'Classic tree recursion demonstrating 15 function calls and the tidy call tree visualizer.',
  code: `public class Main {
    public static int fibo(int n) {
        if (n <= 1) {
            return n;
        }
        return fibo(n - 1) + fibo(n - 2);
    }

    public static void main(String[] args) {
        int result = fibo(5);
        System.out.println("fibo(5) = " + result);
    }
}
`,
};
