'use babel'

/** @jsx etch.dom */

import etch from 'etch'

import EtchComponent from '../etch-component'
import Definition from './definition'
import Icon from '../icon'

export default class Property extends EtchComponent {
  render () {
    let def = [this.props.prop.visibility]
    def.push(this.props.prop.isAbstract ? 'abstract' : null)
    def.push(this.props.prop.isVirtual ? 'virtual' : null)
    def.push(this.props.prop.isStatic ? 'static' : null)
    def.push(this.props.prop.isClass ? 'class ' : null)

    def.push(this.props.prop.valueType.raw)
    def.push(this.props.prop.name)
    def.push('{')
    def.push(this.props.prop.getter ? 'get;' : null)
    def.push(this.props.prop.setter ? 'set;' : null)
    def.push('}')
    return <div>
      <h1><Icon item={this.props.prop} /> {this.props.prop.name}<span className='text-subtle'> &mdash; {this.props.prop.qualifiedName}</span></h1>
      <Definition definition={def.filter(d => { return d !== null }).join(' ')} />
      <div className='block'>
        {this.props.prop.isVirtual ? <span className='badge'>Virtual</span> : null}
        {this.props.prop.isAbstract ? <span className='badge'>Abstract</span> : null}
        {this.props.prop.isStatic ? <span className='badge'>Static</span> : null}
        {this.props.prop.isClass ? <span className='badge'>Class</span> : null}
      </div>
    </div>
  }
}
