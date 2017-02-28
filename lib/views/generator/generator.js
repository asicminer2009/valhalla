'use babel'

/** @jsx etch.dom */

import { TextEditor, CompositeDisposable } from 'atom'
import etch from 'etch'

import { generator } from '../../valhalla'
import EtchComponent from '../etch-component'

export default class Generator extends EtchComponent {
  static show (type) {
    const gen = new Generator({ type: type })
    gen.attach()
  }

  constructor () {
    super(...arguments)

    this.invalidRe = /[^\w.<>,]/

    this.subscriptions = new CompositeDisposable()
    this.subscriptions.add(atom.commands.add(this.element, 'core:cancel', () => { this.onCancel() }))
    this.subscriptions.add(atom.commands.add(this.element, 'core:confirm', () => { this.onConfirm() }))
    this.refs.input.onDidChange(() => { this.checkName() })
  }

  attach () {
    this.panel = atom.workspace.addModalPanel({
      item: this.element
    })
    this.refs.input.element.focused()
  }

  checkName () {
    const name = this.refs.input.getText()
    this.invalidName = name.match(this.invalidRe)
    this.badName = name[0] && name[0].toLowerCase() === name[0]
    this.update()
  }

  onCancel () {
    this.subscriptions.dispose()
    this.destroy()
  }

  onConfirm () {
    if (!this.invalidName) {
      this.subscriptions.dispose()
      generator.gen(this.refs.input.getText(), this.props.type)
      this.destroy()
    }
  }

  render () {
    const type = this.props.type
    return <div>
      <h3>Choose a name for your new {type}</h3>
      <TextEditor ref='input' mini={true} placeholderText={`MyNew${type.charAt(0).toUpperCase()}${type.slice(1)}`}/>
      {this.invalidName
        ? <div className='text-error'><span className='icon icon-x'></span> There is an invalid character in your {type} name.</div>
        : null}
      {this.badName
        ? <div className='text-warning'><span className='icon icon-alert'></span> Type names shoud start with a capital letter.</div>
        : null}
    </div>
  }

  destroy () {
    super.destroy()
    if (this.panel) {
      this.panel.destroy()
    }
  }
}
