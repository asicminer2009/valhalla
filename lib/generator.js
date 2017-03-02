'use babel'

import path from 'path'

export default class Generator {
  genClass (name, fileName = name, parents) {
    const tmpl =
`/**
* A class.
*/
public class ${name} ${parents.length > 0 ? ' : ' + parents.join(', ') : ''} {

    /**
    * A constructor.
    */
    public ${name} () {
        error ("Not implemented yet.");
    }
}`

    this.createEditor(tmpl, fileName)
  }

  genIface (name, fileName = name, parents) {
    const tmpl =
`/**
* An interface.
*/
public interface ${name} ${parents.length > 0 ? ' : ' + parents.join(', ') : ''} {

}`

    this.createEditor(tmpl, fileName)
  }

  createEditor (content, fileName) {
    let editor = atom.workspace.buildTextEditor()
    editor.setText(content)
    let currentDir = path.parse(atom.workspace.getActiveTextEditor().getPath() || document.querySelector('.tree-view .selected').getPath()).dir
    editor.saveAs(path.join(currentDir, fileName + '.vala'))
    atom.workspace.getActivePane().addItem(editor)
    atom.workspace.getActivePane().activateItem(editor)
  }

}
