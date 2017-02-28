'use babel'

/** @jsx etch.dom */

import etch from 'etch'

import EtchComponent from '../etch-component'

export default class Definition extends EtchComponent {
  render () {
    const grammar = atom.grammars.grammarForScopeName(this.props.grammar || 'source.vala')
    const tokens = atom.grammars.decodeTokens(this.props.definition, grammar.tokenizeLine(this.props.definition).tags)
    return <p className='input-text'>{tokens.map(t => {
      return <span className={
        t.scopes[t.scopes.length - 1].split('.').map(s => {
          return `syntax--${s}`
        }).join(' ')
      }>{t.value}</span>
    })}</p>
  }
}
