import type { ExampleProgram } from './sumOfArray';

export const bubbleSortExample: ExampleProgram = {
  id: 'bubble-sort',
  title: 'Bubble Sort (5 elements)',
  category: 'Arrays',
  description: 'Classic bubble sort on 5 elements showcasing nested loops and element swaps.',
  code: `public class Main {
    public static void main(String[] args) {
        int[] arr = {5, 2, 8, 1, 4};
        int n = arr.length;

        for (int i = 0; i < n - 1; i++) {
            for (int j = 0; j < n - i - 1; j++) {
                if (arr[j] > arr[j + 1]) {
                    int temp = arr[j];
                    arr[j] = arr[j + 1];
                    arr[j + 1] = temp;
                }
            }
        }
    }
}
`,
};
