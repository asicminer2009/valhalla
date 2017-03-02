'use babel'

/** @jsx etch.dom */

import etch from 'etch'
import path from 'path'
import { TextEditor, CompositeDisposable } from 'atom'

import { files } from '../../valhalla'
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
      if (ed.getPath() && (ed.getPath().endsWith('.vala') || ed.getPath().endsWith('.vapi'))) {
        this.props.onShow()
        this.file = files.find(f => f.path === ed.getPath())
        if (!this.file) {
          this.message = <p className='text-error icon icon-x'>No symbols for this file.</p>
        } else {
          this.message = null
        }

        ed.onDidStopChanging(() => {
          this.update() // Get freshly parsed symbols
        })
      } else {
        this.message = <p className='icon icon-light-bulb'>Open a Vala file to see symbols.</p>
      }
    } else {
      this.props.onHide()
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
              <h1>{path.basename(this.file.path)}</h1>
              <TextEditor placeholderText='Filter symbols' mini={true} ref='filter'/>
            </header>
            <SymbolsList item={this.file} filter={this.filter} />
          </div>
        }
    </div>
  }
}
