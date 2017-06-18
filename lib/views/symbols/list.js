'use babel'

/** @jsx etch.dom */

import etch from 'etch'

import EtchComponent from '../etch-component'
import Icon from '../icon'
import { AST } from '../../ast'

export default class SymbolsList extends EtchComponent {
  constructor (props, children) {
    props.opened = true
    super(props, children)
    this.writeAfterUpdate()
    this.goTo = this.goTo.bind(this)
    this.toggle = this.toggle.bind(this)
    // Hide symbols from .vapi files by default
    this.props.opened = !(this.props.item && this.props.item.location && this.props.item.location.file && this.props.item.location.file.endsWith('.vapi'))
  }

  shouldDisplay () {
    // don't display if:
    //   - there is no code node for this list item
    //   - the code node don't have a location (and is not the root, since it doesn't have a location)
    //   - the code node doesn't have a name (block)
    if (!this.props.item ||
      (!this.props.item.root && (!this.props.item.location || !this.props.item.name))) {
      return false
    }

    let res = false
    const filter = this.props.filter

    AST.explore(this.props.item, symb => {
      res = res || (!filter ||
        !symb.qualifiedName ||
        symb.qualifiedName.toLowerCase().includes(filter.toLowerCase()))
      return !res
    })

    return res
  }

  haveChildren () {
    return !this.props.item.root && this.props.item.children && this.props.item.children.length > 0 && !(this.props.item.type === 'method')
  }

  render () {
    if (this.shouldDisplay()) {
      return <ul className='list-tree'>
        <li className='list-nested-item'>
          {this.haveChildren()
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
              <SymbolsList item={ch} filter={this.props.filter} file={this.props.file}/>
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
    if (this.props.item.location) {
      atom.workspace.open(this.props.item.location.file, {
        initialLine: this.props.item.location.begin.line - 1,
        initialColumn: this.props.item.location.begin.column - 1
      })
    }
  }
}
