'use babel'

/** @jsx etch.dom */

import path from 'path'
import etch from 'etch'
import { TextEditor, CompositeDisposable } from 'atom'

import * as Valhalla from '../../valhalla'
import EtchComponent from '../etch-component'

export default class Home extends EtchComponent {
  constructor () {
    super(...arguments)
    this.updateSearch = this.updateSearch.bind(this)
    this.subscriptions = new CompositeDisposable()
    this.update()
  }

  updateSearch () {
    this.search = this.refs.filterEditor.getText()
    this.update()
  }

  render () {
    let placeholders = []
    const placeholdersCount = 5
    const vapiOnly = Valhalla.files.filter(s => {
      return s.path.endsWith('.vapi')
    })
    for (let i = 0; i < placeholdersCount; i++) {
      const index = Math.floor(Math.random() * (vapiOnly.length - 1))
      placeholders.push(path.basename(vapiOnly[index].path, '.vapi'))
    }
    const filter = this.search || ''

    const packages = vapiOnly.filter(s => {
      return !filter || filter === '' || s.path.includes(filter)
    })

    return <div>
      <h1>Vala documentation</h1>
      <TextEditor placeholderText='Filter packages' ref='filterEditor' mini={true}/>
      <div className='block'>
        <ul className={packages.length > 0 ? 'list-group' : 'background-message centered'}>
          {packages.length > 0
            ? packages.map(p => {
              return <li className='list-item' onclick={() => this.props.load(p)}>{path.basename(p.path, '.vapi')}</li>
            })
            : <li>No matching package</li>
          }
        </ul>
      </div>
    </div>
  }

  readAfterUpdate () {
    this.subscriptions.add(this.refs.filterEditor.onDidStopChanging(this.updateSearch))
  }

  destroy () {
    this.subscriptions.dispose()
    super.destroy()
  }
}
