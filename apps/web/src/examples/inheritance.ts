import type { ExampleProgram } from './sumOfArray';

export const inheritanceExample: ExampleProgram = {
  id: 'inheritance',
  title: 'Inheritance and Overriding',
  category: 'OOP',
  description: 'Animal superclass and Dog subclass demonstrating constructor chaining (super) and polymorphic overriding.',
  code: `public class Main {
    static class Animal {
        String name;

        Animal(String name) {
            this.name = name;
        }

        void speak() {
            System.out.println(name + " makes a sound");
        }
    }

    static class Dog extends Animal {
        String breed;

        Dog(String name, String breed) {
            super(name);
            this.breed = breed;
        }

        @Override
        void speak() {
            System.out.println(name + " barks");
        }
    }

    public static void main(String[] args) {
        Animal a = new Dog("Buddy", "Golden Retriever");
        a.speak();
    }
}
`,
};
