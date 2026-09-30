public class Inheritance {
  public static void main(String[] args) {
    Dog dog = new Dog("Buddy", 4, true);
  }
}

class Animal {
  String name;
  int legs;

  Animal(String name, int legs) {
    this.name = name;
    this.legs = legs;
  }
}

class Dog extends Animal {
  boolean barks;

  Dog(String name, int legs, boolean barks) {
    super(name, legs);
    this.barks = barks;
  }
}
