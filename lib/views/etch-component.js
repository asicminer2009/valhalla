'use babel'

/** @jsx etch.dom */

import etch from 'etch'

export default class EtchComponent {
  constructor (props = {}, children = [], noInit = false) {
    this.props = props
    this.children = children

    if (!noInit) {
      this.init()
    }
  }

  /**
  * To call when component is ready to be rendered (at the end of the constructor)
  */
  init () {
    etch.initialize(this)
  }

  render () {
    throw new Error('Etch components should implement a render method.')
  }

  update (props, children = this.children) {
    const oldProps = this.props
    this.props = Object.assign({}, oldProps, props)
    this.children = children
    return etch.update(this)
  }

  updateSync (props = this.props, children = this.children) {
    this.props = Object.assign({}, this.props, props)
    this.children = children
    return etch.updateSync(this)
  }

  destroy () {
    etch.destroy(this)
  }
}
