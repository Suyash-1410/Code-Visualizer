public class ObjectCreation {
  public static void main(String[] args) {
    Person p = new Person("Alice", 25);
  }
}

class Person {
  String name;
  int age;

  Person(String name, int age) {
    this.name = name;
    this.age = age;
  }
}
