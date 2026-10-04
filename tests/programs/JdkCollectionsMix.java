import java.util.ArrayDeque;
import java.util.PriorityQueue;
import java.util.Stack;

public class JdkCollectionsMix {
  public static void main(String[] args) {
    Stack<Integer> stack = new Stack<>();
    stack.push(10);
    stack.push(20);
    int sVal = stack.pop();

    ArrayDeque<Integer> deque = new ArrayDeque<>();
    deque.add(30);
    deque.add(40);
    int dVal = deque.poll();

    PriorityQueue<Integer> pq = new PriorityQueue<>();
    pq.offer(50);
    pq.offer(15);
    int pVal = pq.poll();

    System.out.println("sVal=" + sVal + ", dVal=" + dVal + ", pVal=" + pVal);
  }
}
