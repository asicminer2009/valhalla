// This file is for testing purpose.
// So do WTF you want here.

using Gee;

// Most of the code doesn't mean anything, don't try to compile it.
namespace Valhalla.Tests {

    /**
    * Programm begins here.
    */
    int main (string[] args) {
        int a = 0;
        print (saluer ("Bat'", ref a));
        error ("Bug !");
        return 1;
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
    */
    [Version (deprectated = true, deprecated_since = "now", replacement = "nothing")]
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
