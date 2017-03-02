'use babel'

/** @jsx etch.dom */

import etch from 'etch'
import path from 'path'
import fs from 'fs'

import EtchComponent from '../etch-component'

export default class File extends EtchComponent {
  constructor (props, children) {
    super(props, children, true)

    this.openFile = this.openFile.bind(this)
    this.init()
  }

  openFile () {
    atom.workspace.open(this.props.file.path)
  }

  render () {
    let dependencies = []
    if (this.props.file.path.endsWith('.vapi')) {
      try {
        const deps = fs.readFileSync(this.props.file.path.replace('.vapi', '.deps'), 'utf-8')
        dependencies = deps.split('\n').filter(line => { return line.length > 0 })
      } catch (e) {
        dependencies = []
      }
    }

    return <div>
      <div className='block'>
        <h1>{path.basename(this.props.file.path, '.vapi')}</h1>
        <button className='btn icon icon-package inline-block' onclick={this.openFile}>Open {path.basename(this.props.file.path)}</button>
      </div>
        {dependencies.length !== 0
        ? <div className='block'>
          <p>This packages depends on:</p>
          <ul>
            {dependencies.map(d => {
              if (d.length === 0) {
                return
              }
              return <li>{d}</li>
            })}
          </ul>
        </div>
        : <p>This package has no dependencies</p>}
        <ul className='list-group'>
          {this.props.file.children.map(ch => {
            return <li className='list-item' onclick={() => this.props.load(ch)}>{ch.name}</li>
          })}
        </ul>
    </div>
  }
}
