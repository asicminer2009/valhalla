'use babel'

import { serviceForFile } from './valhalla'
import { iconUrl } from './views/icon'

export default class ValaProvider {
  constructor () {
    this.selector = '.source.vala'
    this.disableForSelector = '.source.vala .comment, .source.vala .string'
    this.inclusionPriority = 10
    this.excludeLowerPriority = true

    this.prefixRe = /[\w.]+$/
  }

  getSuggestions (context) {
    this.context = context
    this.context.line = this.context.editor.getTextInRange([[this.context.bufferPosition.row, 0], this.context.bufferPosition]).trim()
    this.context.longPrefix = (this.context.line.match(this.prefixRe) || [this.context.prefix])[0]
    this.suggestions = []

    return this.suggest()
  }

  async suggest () {
    const path = this.context.editor.getPath()
    this.context.service = serviceForFile(path)
    const ast = await this.context.service.getAst()
    this.context.usings = ast.usings.filter(usn => usn.file === path)
    let suggester = this.suggestDefault

    if (this.context.line.startsWith('using ')) {
      suggester = this.suggestUsings
    } else if (this.context.line.endsWith(`new ${this.context.prefix === ' ' ? this.context.prefix : ' ' + this.context.prefix}`)) {
      suggester = this.suggestConstructors
    }

    await this.explore(ast, suggester.bind(this))
    return this.suggestions
  }

  /**
  * Suggest constructors (creation methods) when writing `new ...`
  */
  async suggestConstructors (symb) {
    if (symb.type === 'creation-method') {
      const identifiers = symb.qualifiedName.split('.')
      const className = identifiers[identifiers.length - 2]
      if (className.startsWith(this.context.prefix) || this.context.prefix === ' ') {
        this.suggestions.push({
          snippet: this.snippet(symb.name === 'new' ? className : `${className}.${symb.name}`, symb),
          type: 'method',
          iconHTML: '<span class="icon-letter">c</span>',
          description: this.describe(symb),
          descriptionMoreURL: this.docUrl(symb)
        })
      }
    }
    return symb.type === 'namespace' || symb.type === 'class'
  }

  /**
  * Suggests variables
  */
  async suggestBlock (block) {
    if (block.location.file === this.context.editor.getPath()) {
      if (block.location.begin.line < this.context.bufferPosition.row && block.location.end.line > this.context.bufferPosition.row) {
        for (const variable of block.variables) {
          if (this.context.longPrefix.startsWith(`${variable.name}.`)) {
            let symbol = await this.context.service.symbol(variable.symbolId)
            this.suggestions = []
            while (true) {
              for (const ch of symbol.children) {
                await this.suggestDefault(ch, true)
              }

              if (symbol.parentId === undefined) {
                break
              } else {
                symbol = await this.context.service.symbol(symbol.parentId)
              }
            }
            return false
          } else if (variable.name.startsWith(this.context.prefix)) {
            this.suggestions.push({
              text: variable.name,
              type: 'variable',
              leftLabel: variable.dataType,
              description: variable.comment
            })
          }
        }
        return true
      }
    }
  }

  /**
  * Suggest symbols available in the current context (namespaces, static methods)
  */
  async suggestDefault (symb, forInstance) {
    if (symb.type === 'block') {
      return await this.suggestBlock(symb)
    }

    // suggest parameters
    if (symb.type === 'method' || symb.type === 'creation-method') {
      await this.suggestBlock(symb)
    }

    if (symb.name && symb.type !== 'creation-method' && ((symb.type !== 'method' && symb.type !== 'property') || symb.isStatic || forInstance)) {
      if (symb.qualifiedName.startsWith(this.context.longPrefix) ||
         ((symb.name.startsWith(this.context.prefix) || this.context.prefix === '.') && forInstance && !symb.isStatic)) {
        this.suggestions.push({
          snippet: this.snippet(forInstance ? symb.name : symb.qualifiedName, symb),
          type: symb.type,
          leftLabel: symb.returnType,
          replacementPrefix: forInstance ? undefined : this.context.longPrefix,
          description: this.describe(symb),
          descriptionMoreURL: this.docUrl(symb),
          iconHTML: this.icon(symb)
        })
      } else {
        for (const usn of this.context.usings) {
          if (symb.qualifiedName.startsWith([usn.name, this.context.prefix].join('.'))) {
            this.suggestions.push({
              snippet: this.snippet(symb.name, symb),
              type: symb.type,
              leftLabel: symb.returnType,
              description: this.describe(symb),
              descriptionMoreURL: this.docUrl(symb),
              iconHTML: this.icon(symb)
            })
          }
        }
      }
    }
    return !forInstance
  }

  icon (symb) {
    const icon = symb.type === 'namespace' ? 'atom://valhalla/styles/icons/package.svg' : iconUrl(symb)
    if (atom.config.get('valhalla.customIcons')) {
      return `<img src="${icon}"/>`
    }
  }

  snippet (displayName, symb) {
    let res = displayName
    if ((symb.type === 'creation-method' || symb.type === 'method') && symb.parameters) {
      res += ' ('
      res += symb.parameters.map((param, i) => `${param.direction ? param.direction + ' ' : ''}\${${i + 1}:${param.name}}`).join(', ')
      res += `)\${${symb.parameters.length + 1}:}`
    }
    return res
  }

  async suggestUsings (symb) {
    if (symb.name && !this.context.includes(symb.qualifiedName)) {
      this.suggestions.push({
        text: symb.name,
        replacementPrefix: this.context.longPrefix,
        type: 'namespace',
        description: this.describe(symb),
        descriptionMoreURL: this.docUrl(symb),
        iconHTML: this.icon(symb)
      })
    }
    return symb.type === 'namespace'
  }

  describe (symb) {
    let res = ''
    if (symb.location && symb.location.package) {
      res += `${symb.location.package} — `
    }
    res += symb.qualifiedName
    return res
  }

  docUrl (symb) {
    if (symb.location && symb.location.package) {
      return `https://valadoc.org/${symb.location.package}/${symb.qualifiedName}.html`
    }
  }

  async explore (symbol, cb) {
    const exploreChildren = await cb(symbol)
    if (symbol.children && exploreChildren) {
      for (const ch of symbol.children) {
        await this.explore(ch, cb)
      }
    }
  }
}
