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
public class TestClass : Object {

    public TestClass next {get; set;}

    public int add (int a, int b) {
        return a + b;
    }

    public string hello {get; set;}

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
    }
}
