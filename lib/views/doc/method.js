'use babel'

/** @jsx etch.dom */

import etch from 'etch'

import EtchComponent from '../etch-component'

export default class Method extends EtchComponent {
  hint () {
    if (this.props.method.name === '@get' || this.props.method === 'get') {
      return <p>
        <span className='icon icon-light-bulb'></span>
        You can use <code>var a = b[c];</code> instead of <code>var a = b.get (c);</code>
      </p>
    } else if (this.props.method.name === '@set' || this.props.method.name === 'set') {
      return <p>
        <span className='icon icon-light-bulb'></span>
        You can use <code>a[b] = c;</code> instead of <code>a.set (b, c);</code>
      </p>
    }
  }

  render () {
    return <div>
      <h1>{this.props.method.name}<span className='text-subtle'> &mdash; {this.props.method.qualifiedName}</span></h1>
      <div className='block'>
        {this.props.method.isAsync ? <span className='badge'>Async</span> : null}
        {this.props.method.isVirtual ? <span className='badge'>Virtual</span> : null}
        {this.props.method.isAbstract ? <span className='badge'>Abstract</span> : null}
        {this.props.method.isStatic ? <span className='badge'>Static</span> : null}
        {this.props.method.isClass ? <span className='badge'>Class</span> : null}
      </div>
      {this.hint()}
      {this.props.method.parameters.length > 0
        ? <div>
          <h2>Parameters</h2>
          <ul>
            {this.props.method.parameters.map(p => {
              if (p.isVaList) {
                return <li>...</li>
              }
              return <li>{p.name} ({p.valueType.raw})</li>
            })}
          </ul>
        </div>
        : null}
      <h2>Returns</h2>
      <p>{this.props.method.returnType.raw}</p>
    </div>
  }
}
