'use babel'

/** @jsx etch.dom */

import etch from 'etch'

import EtchComponent from '../etch-component'

export default class SymbolsList extends EtchComponent {
  constructor (props, children) {
    props.opened = true
    super(props, children)
    this.writeAfterUpdate()
    this.goTo = this.goTo.bind(this)
    this.toggle = this.toggle.bind(this)
  }

  icon () {
    switch (this.props.item.type) {
      case 'namespace':
        return <img src='atom://valhalla/styles/icons/namespace.svg' />
      case 'class':
        if (this.props.item.isAbstract) {
          return <img src='atom://valhalla/styles/icons/abstractclass.svg' />
        } else {
          return <img src='atom://valhalla/styles/icons/class.svg' />
        }
      case 'method':
        if (this.props.item.isAbstract) {
          return <img src='atom://valhalla/styles/icons/abstractmethod.svg' />
        } else if (this.props.item.isStatic) {
          return <img src='atom://valhalla/styles/icons/staticmethod.svg' />
        } else if (this.props.item.isVirtual) {
          return <img src='atom://valhalla/styles/icons/virtualmethod.svg' />
        } else {
          return <img src='atom://valhalla/styles/icons/method.svg' />
        }
      case 'property':
        if (this.props.item.isAbstract) {
          return <img src='atom://valhalla/styles/icons/abstractproperty.svg' />
        } else if (this.props.item.isVirtual) {
          return <img src='atom://valhalla/styles/icons/virtualproperty.svg' />
        } else {
          return <img src='atom://valhalla/styles/icons/property.svg' />
        }
      case 'enum':
        return <img src='atom://valhalla/styles/icons/enum.svg' />
      case 'enum-value':
        return <img src='atom://valhalla/styles/icons/enumvalue.svg' />
      case 'error-domain':
        return <img src='atom://valhalla/styles/icons/errordomain.svg' />
      case 'error-domain-value':
        return <img src='atom://valhalla/styles/icons/errorcode.svg' />
      case 'interface':
        return <img src='atom://valhalla/styles/icons/interface.svg' />
      case 'struct':
        return <img src='atom://valhalla/styles/icons/struct.svg' />
      case 'constructor':
        return <img src='atom://valhalla/styles/icons/constructor.svg' />
      case 'delegate':
        return <img src='atom://valhalla/styles/icons/delegate.svg' />
      case 'signal':
        return <img src='atom://valhalla/styles/icons/signal.svg' />
      case 'field':
        return <img src='atom://valhalla/styles/icons/field.svg' />
      case 'constant':
        return <img src='atom://valhalla/styles/icons/constant.svg' />
      default:
        return null
    }
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
                {this.icon()}
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
