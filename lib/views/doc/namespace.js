'use babel'

/** @jsx etch.dom */

import etch from 'etch'

import EtchComponent from '../etch-component'

export default class Namespace extends EtchComponent {
  render () {
    return <div className='block'>
      <h1>{this.props.ns.name}</h1>
      <ul className='list-group'>
        {this.props.ns.children.map(ch => {
          return <li className='list-item' onclick={() => this.props.load(ch)}>{ch.name}</li>
        })}
      </ul>
    </div>
  }
}
