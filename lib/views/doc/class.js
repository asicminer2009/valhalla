'use babel'

/** @jsx etch.dom */

import etch from 'etch'

import EtchComponent from '../etch-component'
import Definition from './definition'

export default class Class extends EtchComponent {
  render () {
    let def = this.props.cls.visibility
    def += this.props.cls.isAbstract ? ' abstract' : ''
    def += ' class '
    def += this.props.cls.name
    def += this.props.cls.inherance ? ` : ${this.props.cls.inherance.map(b => { return b.raw }).join(', ')}` : ''

    return <div>
      <h1>{this.props.cls.name}<span className='text-subtle'> &mdash; {this.props.cls.qualifiedName}</span></h1>
      <Definition definition={def} />
      <div className='block'>
        {this.props.cls.isAbstract ? <span className='badge'>Abstract</span> : null}
      </div>
      {this.props.cls.inherance
        ? <div>
          <h2>Parent types</h2>
          <ul>
            {this.props.cls.inherance.map(baseType => {
              return <li>{baseType.raw}</li>
            })}
          </ul>
        </div>
        : null}
      <div className='block'>
        <ul className='list-group'>
          {this.props.cls.children.map(ch => {
            return <ul className='list-item' onclick={() => { this.props.load(ch) }}>{ch.name}</ul>
          })}
        </ul>
      </div>
    </div>
  }
}
