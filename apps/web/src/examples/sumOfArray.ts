export interface ExampleProgram {
  id: string;
  title: string;
  category: 'Arrays' | 'Recursion' | 'OOP' | 'Errors';
  description: string;
  code: string;
}

export const sumOfArrayExample: ExampleProgram = {
  id: 'sum-of-array',
  title: 'Sum of an Array',
  category: 'Arrays',
  description: 'Iterates through a 1D integer array and computes the total sum.',
  code: `public class Main {
    public static void main(String[] args) {
        int[] arr = {1, 2, 3, 4, 5};
        int sum = 0;

        for (int i = 0; i < arr.length; i++) {
            sum += arr[i];
        }

        System.out.println("Sum = " + sum);
    }
}
`,
};
