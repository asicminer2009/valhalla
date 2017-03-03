'use babel'

/** @jsx etch.dom */

import etch from 'etch'

import EtchComponent from '../etch-component'
import Icon from '../icon'

export default class SymbolsList extends EtchComponent {
  constructor (props, children) {
    props.opened = true
    super(props, children)
    this.writeAfterUpdate()
    this.goTo = this.goTo.bind(this)
    this.toggle = this.toggle.bind(this)
  }

  shouldDisplay () {
    let res = false

    const filter = this.props.filter
    const explore = (scope) => {
      res = res || (!filter ||
        !scope.qualifiedName ||
        scope.qualifiedName.toLowerCase().includes(filter.toLowerCase()))
      if (scope.children) {
        for (const ch of scope.children) {
          explore(ch)
        }
      }
    }

    explore(this.props.item)

    return res
  }

  render () {
    if (this.shouldDisplay()) {
      return <ul className='list-tree'>
        <li className='list-nested-item'>
          {this.props.item.type !== 'file' && this.props.item.children && this.props.item.children.length > 0
            ? <span className={`icon icon-chevron-${this.props.opened ? 'down' : 'right'}`} onclick={() => this.toggle()}></span>
            : null
          }
          {this.props.item.name
            ? <span className='list-item' onclick={() => this.goTo()}>
                <Icon item={this.props.item} />
                <span>{this.props.item.name}</span>
            </span>
            : null}
          {this.props.opened && this.props.item.children && this.props.item.children.length > 0
            ? this.props.item.children.map(ch =>
              <SymbolsList item={ch} filter={this.props.filter} />
            )
            : null}
        </li>
      </ul>
    } else {
      return <p style='display: none;'></p>
    }
  }

  writeAfterUpdate () {
    if (this.element) {
      this.element.item = this.props.item
    }
  }

  toggle () {
    this.props.opened = !this.props.opened
    this.update()
  }

  goTo () {
    if (this.props.item.position) {
      atom.workspace.getActiveTextEditor().setCursorBufferPosition([
        this.props.item.position.begin.line,
        this.props.item.position.begin.column - 1
      ])
    }
  }
}
