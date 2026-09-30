import type { ExampleProgram } from './sumOfArray';

export const simpleClassExample: ExampleProgram = {
  id: 'simple-class',
  title: 'Simple Class with Constructor',
  category: 'OOP',
  description: 'Instantiates Point objects on the heap, invokes methods, and tracks field mutations.',
  code: `public class Main {
    static class Point {
        int x;
        int y;

        Point(int x, int y) {
            this.x = x;
            this.y = y;
        }

        void translate(int dx, int dy) {
            this.x += dx;
            this.y += dy;
        }
    }

    public static void main(String[] args) {
        Point p1 = new Point(10, 20);
        p1.translate(5, -3);
        Point p2 = new Point(0, 0);
    }
}
`,
};
