import type { ExampleProgram } from './sumOfArray';

export const towerOfHanoiExample: ExampleProgram = {
  id: 'tower-of-hanoi',
  title: 'Tower of Hanoi (3 disks)',
  category: 'Recursion',
  description: 'Solves the 3-disk Tower of Hanoi puzzle across source, destination, and auxiliary pegs.',
  code: `public class Main {
    public static void solve(int n, char from, char to, char aux) {
        if (n == 1) {
            System.out.println("Move disk 1 from " + from + " to " + to);
            return;
        }
        solve(n - 1, from, aux, to);
        System.out.println("Move disk " + n + " from " + from + " to " + to);
        solve(n - 1, aux, to, from);
    }

    public static void main(String[] args) {
        solve(3, 'A', 'C', 'B');
    }
}
`,
};
