'use babel';

import * as path from 'path';

export default class Generator {

    constructor () {

    }

    gen (name, type) {
        switch (type) {
            case 'class':
                this.genClass(name);
                break;
            case 'interface':
                this.genIface(name);
                break;
            default:
                this.genClass(name);
                break;
        }
    }

    genClass(name) {
        const tmpl =`/**
* A class.
*/
public class ${name} : Object {

    /**
    * A constructor.
    */
    public ${name} () {

    }
}`;

        this.createEditor(tmpl, name);
    }

    genIface(name) {
        const tmpl =`/**
* An interface.
*/
public interface ${name} {

}`;

        this.createEditor(tmpl, name);
    }

    createEditor (content, name) {
        let editor = atom.workspace.buildTextEditor();
        editor.setText(content);
        let currentDir = path.parse(document.querySelector('.tree-view .selected').getPath()).dir;
        editor.saveAs(path.join(currentDir, name + '.vala'));
        atom.workspace.getActivePane().addItem(editor);
        atom.workspace.getActivePane().activateItem(editor);
    }

}
