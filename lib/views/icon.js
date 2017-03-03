'use babel'

/** @jsx etch.dom */

import etch from 'etch'

import EtchComponent from './etch-component'

export default class Icon extends EtchComponent {
  render () {
    switch (this.props.item.type) {
      case 'file':
        return <img src='atom://valhalla/styles/icons/package.svg' />
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
}
