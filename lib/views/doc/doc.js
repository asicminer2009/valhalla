'use babel'

/** @jsx etch.dom */

import path from 'path'
import etch from 'etch'
import { TextEditor, Emitter } from 'atom'

import Home from './home'
import Namespace from './namespace'
import Class from './class'
import Interface from './interface'
import Method from './method'
import Property from './property'
import Enum from './enum'
import Icon from '../icon'
import Definition from './definition'

import EtchComponent from '../etch-component'
import * as Valhalla from '../../valhalla'

export default class extends EtchComponent {
  constructor (props, children) {
    super(props, children, true)
    this.packSearchRe = /\bpackage:(\S+)\b/
    this.emitter = new Emitter()

    this.openSearch = this.openSearch.bind(this)
    this.closeSearch = this.closeSearch.bind(this)
    this.updateSearch = this.updateSearch.bind(this)
    this.load = this.load.bind(this)

    this.init()
  }

  openSearch () {
    this.searchOpened = true
    this.update()
  }

  closeSearch () {
    this.searchOpened = false
    this.update()
  }

  updateSearch () {
    this.query = this.refs.searchBox.getText()
    this.update()
  }

  searchResults () {
    let results = []
    let searchedText = this.query || ''
    const resultsLimit = 200
    const match = searchedText.match(this.packSearchRe)
    if (match) {
      searchedText = searchedText.replace(this.packSearchRe, '').trim()
    }
    const onlyIn = match ? match[1] : null

    for (const file of Valhalla.files) {
      if (onlyIn && !file.path.endsWith(onlyIn + '.vapi')) {
        continue
      }

      file.explore(scope => {
        if (resultsLimit >= results.length && scope.name.includes(searchedText)) {
          results.push({scope, file})
        }
        return resultsLimit < results.length
      })
    }

    if (results.length === 0) {
      return <ul className='background-message centered'>
        <li>Sorry, didn't found any matching item. Try another search.</li>
      </ul>
    } else {
      return <ul className='list-group'>{
        results.map(res =>
          <li className='list-item' onclick={() => this.load(res.scope)}>
            <code className='no-bg'>{res.scope.name}</code>
            <span className='text-subtle'> &mdash; from {path.basename(res.file.path, '.vapi')}</span>
          </li>)
      }</ul>
    }
  }

  content (item) {
    if (this.searchOpened) {
      return this.searchResults()
    } else {
      if (item) {
        this.title = item.name
        switch (item.type) {
          case 'namespace':
            return <div><Namespace ns={item} load={this.load}/></div>
          case 'class':
            return <div><Class cls={item} load={this.load}/></div>
          case 'interface':
            return <div><Interface iface={item} load={this.load}/></div>
          case 'method':
            return <div><Method method={item} load={this.load}/></div>
          case 'property':
            return <div><Property prop={item} /></div>
          case 'enum':
          case 'error-domain':
            return <div><Enum enm={item} load={this.load} /></div>
          default:
            this.title = 'Oops'
            return <div>
              <h1>Error unhandled scope type: {item.type} ({item.qualifiedName})</h1>
              <p>Please create an issue on GitHub to report this problem.</p>
              <button className='btn btn-lg' onclick={() => this.load()} >Go back home</button>
            </div>
        }
      } else {
        this.title = 'Home'
        return <div><Home load={this.load}/></div>
      }
    }
  }

  load (item, title = item.name) {
    this.props.item = item
    this.searchOpened = false
    this.title = title
    this.emitter.emit('change-title')
    this.update()
  }

  render () {
    let breadCumbItems = []
    let item = this.props.item
    while (item && item.name) {
      breadCumbItems.push(item)
      item = item.parent
    }

    return <div className='pane-item valadoc'>
      <header>
        {
          this.searchOpened
          ? <div className='search-container'>
              <TextEditor mini={true} placeholderText='Search the docs. Use package:name to search only a specific package.' ref='searchBox'/>
              <a className='inline-block icon icon-x' onclick={this.closeSearch}></a>
            </div>
          : <div>
              <a className='inline-block icon icon-home' onclick={() => this.load(null, 'Home')}></a>
              {breadCumbItems.reverse().map(item =>
                <a onclick={() => this.load(item)}>
                  <span className='icon icon-chevron-right'></span>{item.name}
                </a>
              )}
              <a className='inline-block icon icon-search' onclick={this.openSearch}></a>
            </div>
        }
      </header>
      {this.props.item
        ? <div>
          <h1 className='icon-before'>
            <Icon item={this.props.item} />
            {this.props.item.name}
            {this.props.item.name !== this.props.item.qualifiedName
              ? <span className='text-subtle'>&nbsp;&mdash; {this.props.item.qualifiedName}</span>
              : null
            }
          </h1>
          <Definition definition='public foo bar : x ()' />
          <div className='block'>
            {this.props.item.isAbstract ? <span className='badge'>Abstract</span> : null}
          </div>
          {this.props.item.inherance
            ? <div>
              <h2>Parent types</h2>
              <ul>
                {this.props.item.inherance.map(baseType => <li>{baseType.raw}</li>)}
              </ul>
            </div>
            : null}
          {this.props.item.children
            ? <div className='block'>
              <ul className='list-group'>
                {this.props.item.children.map(ch =>
                  <li className='list-item' onclick={() => this.load(ch)}>
                    <Icon item={ch} />
                    {ch.name}
                  </li>
                )}
              </ul>
            </div>
            : null
          }
        </div>
        : <Home load={this.load}/>
      }
    </div>
  }

  readAfterUpdate () {
    if (this.searchOpened) {
      this.refs.searchBox.onDidStopChanging(this.updateSearch)
    }
  }

  destroy () {
    if (this.props.onDestroy) {
      this.props.onDestroy()
    }
    super.destroy()
  }

  onDidChangeTitle (cb) {
    return this.emitter.on('change-title', cb)
  }

  getElement () {
    return this.element
  }

  getTitle () {
    return `${this.title} — Vala documentation`
  }

  getIconName () {
    return 'book'
  }

  getDefaultLocation () {
    return 'center'
  }
}
