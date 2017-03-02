'use babel'

/** @jsx etch.dom */

import { TextEditor, CompositeDisposable } from 'atom'
import etch from 'etch'

import EtchComponent from '../etch-component'

export default class Input extends EtchComponent {
  static show (title, onConfirm, placeholder, validate) {
    const gen = new Input({ title, onConfirm, placeholder, validate })
    gen.attach()
  }

  constructor () {
    super(...arguments)

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
    const input = this.refs.input.getText()
    const { error, warnings } = this.props.validate(input)
    this.error = error
    this.warnings = warnings
    this.update()
  }

  onCancel () {
    this.subscriptions.dispose()
    this.destroy()
  }

  onConfirm () {
    if (!this.invalidName && this.props.onConfirm) {
      this.subscriptions.dispose()
      this.props.onConfirm(this.refs.input.getText())
      this.destroy()
    }
  }

  render () {
    return <div className='block'>
      <div className='message'>{this.props.title}</div>
      <TextEditor ref='input' mini={true} placeholderText={this.props.placeholder}/>
      {this.error
        ? <div className='text-error'><span className='icon icon-x'></span> {this.error}</div>
        : null}
      {this.warnings && this.warnings.length > 0
        ? this.warnings.map(w => <div className='text-warning'><span className='icon icon-alert'></span> {w}</div>)
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
