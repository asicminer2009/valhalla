// This file is for testing purpose.
// So do WTF you want here.

using Gee;
using Gdk;
using ZLib;

// Most of the code doesn't mean anything, don't try to compile it.
namespace Valhalla.Tests {

    /**
    * Programm begins here.
    */
    int main (string[] args) {
        int a = 0;
        TestClass tc = new TestClass (blob, zoup, ref yo);
        tc.add (1, 3);
        print (saluer ("Bat'", ref a));
        error ("Bug !");
        return 1;
        ArrayList<string> arr = new ArrayList (null);
        arr.add ("hey");
        arr.add_all();
        HashMap<int, string> map = new HashMap (null, null, null);
        Canvas cv = new Canvas();
        cv.x1 = 12.5;
        cv.unregister_item(model);
    }

    /**
    * Logs an error. Or just use {@link GLib.error}
    *
    * @return hey hh
    * @param err The error to log
    */
    void error (string err) {
        print ("[ERROR] %s\n", err);
    }

    /**
    * Salue une personne.
    *
    * @param nom Un nom
    * @param age Sert à rien, mais amusez vous
    * @return La phrase pour saluer la personne.
    */
    string saluer (string nom, ref int age) {
        print (nom);
        return "Bonjour " + nom + " !";
    }

    /**
    * Salue une personne, en anglais.
    */
    string saluer_anglais (string name, int age) {
        return "Hello " + name + " !";
    }

}
