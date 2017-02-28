'use babel'

/** @jsx etch.dom */

import path from 'path'
import etch from 'etch'
import { TextEditor, Emitter } from 'atom'

import Home from './home'
import File from './file'
import Namespace from './namespace'
import Class from './class'
import Interface from './interface'
import Method from './method'
import Property from './property'
import Enum from './enum'

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
    this.update()
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
    let onlyIn
    const resultsLimit = 200
    const match = searchedText.match(this.packSearchRe)
    if (match) {
      searchedText = searchedText.replace(this.packSearchRe, '').trim()
      onlyIn = match[1]
    }

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
        <li>Sorry, didn't found any matching item. Try another query.</li>
      </ul>
    } else {
      return <ul className='list-group'>{
        results.map(res => {
          return <li className='list-item' onclick={() => this.load(res.scope)}>
            <code className='no-bg'>{res.scope.name}</code>
            <span className='text-subtle'> &mdash; from {path.basename(res.file.path, '.vapi')}</span>
          </li>
        })
      }</ul>
    }
  }

  content (item) {
    if (this.searchOpened) {
      return this.searchResults()
    } else {
      if (item) {
        this.title = item.name
        // We don't use JSX here because it just stops rendering sometimes...
        // TODO: fix it to keep code coherent
        switch (item.type) {
          case 'file':
            this.title = path.basename(item.path, '.vapi')
            return new File({ file: item, load: this.load }).render()
          case 'namespace':
            return new Namespace({ ns: item, load: this.load }).render()
          case 'class':
            return new Class({ cls: item, load: this.load }).render()
          case 'interface':
            return new Interface({ iface: item, load: this.load }).render()
          case 'method':
            return new Method({ method: item, load: this.load }).render()
          case 'property':
            return <Property prop={item} />
          case 'enum':
          case 'error-domain':
            return <Enum enm={item} load={this.load} />
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
        return <Home load={this.load} />
      }
    }
  }

  load (item) {
    this.item = item
    this.searchOpened = false
    this.update()
  }

  render () {
    let breadCumbItems = []
    let item = this.item
    while (item) {
      breadCumbItems.push(item)
      item = item.parent
    }

    const content = this.content(this.item)
    this.emitter.emit('change-title')
    return <div className='pane-item valadoc'>
      <header>
        {
          this.searchOpened
          ? <div className='search-container'>
              <TextEditor mini={true} placeholderText='Search the docs. Use package:name to search only a specific package.' ref='searchBox'/>
              <a className='inline-block icon icon-x' onclick={this.closeSearch}></a>
            </div>
          : <div>
              <a className='inline-block icon icon-home' onclick={() => this.load()}></a>
              {breadCumbItems.reverse().map(item => {
                return <a onclick={() => this.load(item)}><span className='icon icon-chevron-right'></span>{item.name ? item.name : path.basename(item.path, '.vapi')}</a>
              })}
              <a className='inline-block icon icon-search' onclick={this.openSearch}></a>
            </div>
        }
      </header>
      {content}
    </div>
  }

  readAfterUpdate () {
    if (this.searchOpened) {
      this.refs.searchBox.onDidStopChanging(this.updateSearch)
    }
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
}
