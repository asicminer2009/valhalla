'use babel'

/** @jsx etch.dom */

import etch from 'etch'

import EtchComponent from '../etch-component'
import Definition from './definition'
import Icon from '../icon'

export default class Interface extends EtchComponent {
  render () {
    let def = this.props.iface.visibility
    def += ' interface '
    def += this.props.iface.name
    def += this.props.iface.inherance ? ` : ${this.props.iface.inherance.map(b => { return b.raw }).join(', ')}` : ''
    return <div>
      <h1><Icon item={this.props.iface} /> {this.props.iface.name}<span className='text-subtle'> &mdash; {this.props.iface.qualifiedName}</span></h1>
      <Definition definition={def} />
      {this.props.iface.inherance
        ? <div>
          <h2>Parent types</h2>
          <ul>
            {this.props.iface.inherance.map(baseType => {
              return <li>{baseType.raw}</li>
            })}
          </ul>
        </div>
        : null}
      <div className='block'>
        <ul className='list-group'>
          {this.props.iface.children.map(ch => {
            return <li className='list-item' onclick={() => { this.props.load(ch) }}>
              <Icon item={ch} />
              {ch.name}
            </li>
          })}
        </ul>
      </div>
    </div>
  }
}
