public class ArrayListLike {
  int[] data;
  int size;

  public ArrayListLike() {
    this.data = new int[4];
    this.size = 0;
  }

  public void add(int val) {
    if (size == data.length) {
      int[] next = new int[data.length * 2];
      for (int i = 0; i < size; i++) next[i] = data[i];
      data = next;
    }
    data[size++] = val;
  }

  public int get(int index) {
    return data[index];
  }

  public void set(int index, int val) {
    data[index] = val;
  }

  public static void main(String[] args) {
    ArrayListLike list = new ArrayListLike();
    list.add(10);
    list.add(20);
    list.add(30);
    System.out.println("size=" + list.size + ", elem1=" + list.get(1));
  }
}
