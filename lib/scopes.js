'use babel';

export default class ScopeManager {

    constructor() {

    }

    parse(code) {
        console.log('parsgin !');
        code.split('\n').forEach((line, arr, index) => {
            line = line.replace ('\t', '');

            if (match = line.match (/(.*) ({\n)$/gm)) {
                console.log(`found symbol : ${match}`);
            }
        });
    }

    scopeFor(path, cursor) {

    }
}
