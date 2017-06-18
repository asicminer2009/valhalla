'use babel'

/** @jsx etch.dom */

import etch from 'etch'

import { serviceForFileOrDefault } from '../../valhalla'
import Icon from '../icon'
import EtchComponent from '../etch-component'

export default class Home extends EtchComponent {
  constructor (props, children) {
    props.rootSymbols = []
    super(props, children)
    this.loadAst()
  }

  loadAst () {
    serviceForFileOrDefault('').then(service => {
      return service.getAst()
    }).then(ast => {
      const rootSymbols = ast.tree.children[0].children.filter(ch => ch.location && ch.location.file && ch.location.file.endsWith('.vapi'))
      this.update({ rootSymbols })
    })
  }

  render () {
    return <div>
      <h1>Vala documentation</h1>
      <div className='block'>
        <ul className='list-group'>
          {this.props.rootSymbols.map(ns =>
            <li className='list-item' onclick={() => this.props.load(ns)}>
              <Icon item={ns}/>
              {ns.qualifiedName}
            </li>
          )}
        </ul>
      </div>
    </div>
  }
}
