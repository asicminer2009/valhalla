'use babel'

/** @jsx etch.dom */

import etch from 'etch'
import { TextEditor, CompositeDisposable } from 'atom'

import { serviceForFile } from '../../valhalla'
import EtchComponent from '../etch-component'
import SymbolsList from './list'

export default class SymbolsView extends EtchComponent {
  constructor () {
    super(...arguments)
    this.subscriptions = new CompositeDisposable()
    this.subscriptions.add(atom.workspace.onDidChangeActivePaneItem(item => {
      this.loadSymbols(item)
      this.update()
    }))
    this.loadSymbols(atom.workspace.getActivePaneItem())
    this.update()
  }

  readAfterUpdate () {
    if (this.refs.filter) {
      this.subscriptions.add(this.refs.filter.onDidStopChanging(this.updateFilter.bind(this)))
    }
  }

  destroy () {
    this.subscriptions.dispose()
    super.destroy()
  }

  loadSymbols (ed) {
    if (ed instanceof TextEditor) {
      this.file = ed.getPath()
    }

    this.message = null
    const service = serviceForFile(this.file, true)
    if (service) {
      service.getAst().then(ast => {
        this.ast = ast.tree.children[0]
        this.update()
      })
    } else {
      this.message = <p className='text-error icon icon-x'>It looks like this project have not been parsed.</p>
    }
  }

  updateFilter () {
    this.filter = this.refs.filter.getText()
    this.update()
  }

  render () {
    return <div className='padded vala-symbols'>
      {this.message || !this.file
        ? this.message
        : <div>
            <header className='padded'>
              <TextEditor placeholderText='Filter symbols' mini={true} ref='filter'/>
            </header>
            <SymbolsList item={this.ast} filter={this.filter} file={this.file}/>
          </div>
        }
    </div>
  }

  getTitle () {
    return 'Symbols'
  }

  // Needs file-icons to be installed
  // But if it is not present, no icon will be displayed
  getIconName () {
    return 'gnome-icon'
  }

  getDefaultLocation () {
    return 'right'
  }

  getAllowedLocations () {
    return [ 'right', 'left' ]
  }

  getURI () {
    return 'atom://valhalla/symbols'
  }
}
