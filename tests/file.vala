using Valse;

/**
* Test
*
* Loleu
* Re loleu
*
* @return truc
*/
void main () {
    print(saluer_anglais("Bat'", 745));
}

/**
* Salue une personne.
*/
string saluer (string nom, int age) {
    return "Bonjour " + nom + " !";
}

/**
* Salue une personne, en anglais.
*/
string saluer_anglais (string nom, int age) {
    return "Hello " + nom + " !";
}
