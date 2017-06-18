'use babel'

/** @jsx etch.dom */

import etch from 'etch'

import EtchComponent from './etch-component'

export function iconUrl (symb) {
  switch (symb.type) {
    case 'file':
      return 'atom://valhalla/styles/icons/package.svg'
    case 'namespace':
      return 'atom://valhalla/styles/icons/namespace.svg'
    case 'class':
      if (symb.isAbstract) {
        return 'atom://valhalla/styles/icons/abstractclass.svg'
      } else {
        return 'atom://valhalla/styles/icons/class.svg'
      }
    case 'method':
      if (symb.isAbstract) {
        return 'atom://valhalla/styles/icons/abstractmethod.svg'
      } else if (symb.isStatic) {
        return 'atom://valhalla/styles/icons/staticmethod.svg'
      } else if (symb.isVirtual) {
        return 'atom://valhalla/styles/icons/virtualmethod.svg'
      } else {
        return 'atom://valhalla/styles/icons/method.svg'
      }
    case 'property':
      if (symb.isAbstract) {
        return 'atom://valhalla/styles/icons/abstractproperty.svg'
      } else if (symb.isVirtual) {
        return 'atom://valhalla/styles/icons/virtualproperty.svg'
      } else {
        return 'atom://valhalla/styles/icons/property.svg'
      }
    case 'enum':
      return 'atom://valhalla/styles/icons/enum.svg'
    case 'enum-value':
      return 'atom://valhalla/styles/icons/enumvalue.svg'
    case 'error-domain':
      return 'atom://valhalla/styles/icons/errordomain.svg'
    case 'error-code':
      return 'atom://valhalla/styles/icons/errorcode.svg'
    case 'interface':
      return 'atom://valhalla/styles/icons/interface.svg'
    case 'struct':
      return 'atom://valhalla/styles/icons/struct.svg'
    case 'creation-method':
    case 'constructor':
      return 'atom://valhalla/styles/icons/constructor.svg'
    case 'delegate':
      return 'atom://valhalla/styles/icons/delegate.svg'
    case 'signal':
      return 'atom://valhalla/styles/icons/signal.svg'
    case 'field':
      return 'atom://valhalla/styles/icons/field.svg'
    case 'constant':
      return 'atom://valhalla/styles/icons/constant.svg'
    default:
      return null
  }
}

export default class Icon extends EtchComponent {
  render () {
    return <img src={iconUrl(this.props.item)} alt={this.props.item.type}/>
  }
}
