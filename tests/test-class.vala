namespace A {
    class B {
        enum C {
            D,
            E,
            F
        }
    }
    void method () {
        return;
    }
}

public enum Hey {
    BLOB,
    POP,
    PLOUF
}

enum Jon {
    FOO,
    BAR
}

/**
* A class.
*/
public class TestClass : Object, Glop {

    /**
    * YATP
    *
    * Yet Another Test Property.
    */
    public TestClass next { get; set; }

    /**
    * Adds two numbers
    *
    * Here to test valadoc comments.
    *
    * @param a A number
    * @param b Another number
    * @return a + b
    */
    public int add (int a, int b) {
        return a + b;
    }

    private void blob () {
        print ("BLOB\n");
        this.h
    }

    public string hello { get; set; }

    public signal void foo ();

    public delegate G Func<G> ();

    public int number;

    public const double PI;

    public static void log_error (string err) {
        print ("[ERROR] %s \n", err);
    }

    /**
    * A constructor.
    */
    public TestClass (string blob, int zoup, ref bool yo) {
        string hey = this.hello;
        this.add (1, 2);
        TestClass.log_error ("hdjdd");
        this.hello = "hey";
        var plop = GtkInputMode.SCREEN;
        this.blob ();
    }
}

interface Glop {
    public abstract void is_glop (Object obj);
}

struct Point {
    int x;
    int y;

    Point add (Point other) {
        return Point (this.x + other.x, this.y + other.y);
    }

    Point (int x, int y) {
        this.x = x;
        this.y = y;
    }
}
