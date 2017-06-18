'use babel'

/** @jsx etch.dom */

import etch from 'etch'

import EtchComponent from '../etch-component'
import Definition from './definition'
import Icon from '../icon'

export default class Enum extends EtchComponent {
  render () {
    let def = `${this.props.enm.visibility} ${this.props.enm.type.replace('-', '')} ${this.props.enm.name}`

    const methods = this.props.enm.children.filter(ch => ch.type === 'method')
    const constants = this.props.enm.children.filter(ch => ch.type === 'constant')

    return <div>
      <h1><Icon item={this.props.enm} /> {this.props.enm.name}<span className='text-subtle'> &mdash; {this.props.enm.qualifiedName}</span></h1>
      <Definition definition={def} />
      <h2>Values</h2>
      <ul className='no-dot'>
        {
          this.props.enm.children
            .filter(ch => ch.type === (this.props.enm.type === 'enum' ? 'enum-value' : 'error-code'))
            .map(v => <li><Icon item={v} />{v.name}</li>)
        }
      </ul>
      {
        methods.length > 0
        ? <div><h2>Methods</h2>
        <ul className='list-group'>
          {
            methods.map(m => <li className='list-item' onclick={() => this.props.load(m)}>
              <Icon item={m} />
              {m.name}
            </li>)
          }
        </ul></div>
        : null
      }
      {
        constants.length > 0
        ? <div><h2>Constants</h2>
        <ul className='list-group'>
          {
            constants.map(c => <li className='list-item' onclick={() => this.props.load(c)}>
              <Icon item={c} />
              {c.name}
            </li>)
          }
        </ul></div>
        : null
      }
    </div>
  }
}
