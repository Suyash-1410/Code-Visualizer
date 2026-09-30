import type { ExampleProgram } from './sumOfArray';

export const arrayIndexExceptionExample: ExampleProgram = {
  id: 'array-index-exception',
  title: 'ArrayIndexOutOfBoundsException',
  category: 'Errors',
  description: 'Intentionally accesses an out-of-bounds array index to demonstrate runtime exception visualization.',
  code: `public class Main {
    public static void main(String[] args) {
        int[] numbers = {10, 20, 30};

        // Accessing index 5 in an array of size 3 throws ArrayIndexOutOfBoundsException
        int value = numbers[5];
        System.out.println(value);
    }
}
`,
};
