'use babel'

import path from 'path'

import * as Valhalla from './valhalla'
import keywords from './keywords'
import snippets from './snippets'

export default class ValaProvider {
  constructor () {
    this.selector = '.source.vala'
    this.disableForSelector = '.source.vala .comment, .source.vala .string'
    this.inclusionPriority = 10
    this.excludeLowerPriority = true
  }

  getSuggestions ({editor, bufferPosition, scopeDescriptor, prefix, activatedManually}) {
    const line = editor.getTextInRange([[bufferPosition.row, 0], bufferPosition]).trim()
    this.suggestions = []

    this.currentFile = Valhalla.files.find(f => {
      return f.path === editor.getPath()
    })

    this.currentScope = this.currentFile
    this.currentFile.explore((scope) => {
      if (!scope.position) {
        return true
      }

      if (scope.position.begin.line <= bufferPosition.row && scope.position.end.line > bufferPosition.row) {
        this.currentScope = scope
        return false
      }
      return true
    })

    return new Promise(resolve => {
      this.suggestKeywords(prefix)
      this.suggestSnippets(prefix)

      for (const file of Valhalla.files) {
        file.explore(scope => {
          // We return true if we want to stop exploring this branch of the tree
          if (line.startsWith('using ') || (line === 'using' && prefix === ' ')) {
            return this.suggestNamespaces(scope, file, line, prefix, true)
          } else if (line.startsWith('namespace ')) {
            return this.suggestNamespaces(scope, file, line, prefix)
          } else if (line.endsWith('throw new ' + (prefix === ' ' ? '' : prefix))) {
            return this.suggestErrors(scope, file, line, prefix)
          } else if (line.endsWith('new ' + (prefix === ' ' ? '' : prefix))) {
            return this.suggestClasses(scope, file, line, prefix)
          } else if (line.endsWith('this.' + (prefix === '.' ? '' : prefix))) {
            return this.suggestThis(scope, file, line, prefix)
          } else if (prefix === '.' || line.endsWith('.' + prefix)) {
            return this.suggestEnumMembers(scope, file, line, prefix) &&
                   this.suggestQualified(scope, file, line, prefix)
          } else {
            return this.suggestQualified(scope, file, line, prefix)
          }
        })
      }

      resolve(this.suggestions)
    })
  }

  getExpression (line) {
    let expr = ['']
    for (const char of line) {
      if (char === '(' || char === '{' || char === '[') {
        expr.push('')
      } else if (char === ')' || char === '}' || char === ']') {
        expr.pop()
      } else {
        expr[expr.length - 1] += char
      }
    }
    return expr[expr.length - 1]
  }

  buildMethodSuggestion (meth, displayName = meth.name) {
    let counter = 0
    return {
      type: 'method',
      displayText: displayName,
      leftLabel: meth.returnType.raw,
      snippet: `${displayName} (${meth.parameters.filter(p => !(p.isVaList || p.hasDefault)).map(p => {
        counter++
        return '${' + counter + ':' + (p.out ? 'out ' : '') + (p.ref ? 'ref ' : '') + p.name + '}'
      }).join(', ')});`,
      rightLabelHTML: meth.parameters.map(p => {
        if (p.isVaList) {
          return '<span class="syntax--storage syntax--modifier syntax--vala">...</span>'
        }
        let html = p.out ? '<span class="syntax--storage syntax--modifier syntax--vala">out </span>' : ''
        html += p.ref ? '<span class="syntax--storage syntax--modifier syntax--vala">ref </span>' : ''
        html += `<span class="syntax--storage syntax--type syntax--vala">${p.valueType.raw} </span>`
        html += `<span class="syntax--variable syntax--parameter syntax--vala">${p.name}</span>`
        return html
      }).join(', '),
      description: meth.qualifiedName
    }
  }

  suggestQualified (scope, file, line, prefix) {
    if ((scope.type === 'method' && scope.isStatic === true) || scope.type === 'namespace') {
      const expr = this.getExpression(line)
      if (scope.qualifiedName.startsWith(expr)) {
        if (scope.type === 'method') {
          this.suggestions.push(this.buildMethodSuggestion(scope, scope.qualifiedName))
          return true
        } else {
          this.suggestions.push({
            type: scope.type,
            text: scope.qualifiedName,
            description: scope.qualifiedName
          })
          return false
        }
      } else if (scope.qualifiedName.includes(expr)) {
        for (const using of file.usingDirectives) {
          if (scope.qualifiedName.startsWith([using, expr].join('.'))) {
            if (scope.type === 'method') {
              this.suggestions.push(this.buildMethodSuggestion(scope, scope.qualifiedName.replace(using + '.', '')))
              return true
            } else {
              this.suggestions.push({
                type: scope.type,
                text: scope.qualifiedName.replace(using + '.', ''),
                description: scope.qualifiedName
              })
              return false
            }
          }
        }
      }
    }
    return !['namespace', 'class', 'enum', 'errordomain', 'interface', 'struct'].includes(scope.type)
  }

  suggestEnumMembers (scope, file, line, prefix) {
    const split = line.split('.')
    const enumName = split[split.length - 2]
    if (scope.type === 'enum-value' && ((scope.name.startsWith(prefix) || prefix === '.') && scope.parent.name === enumName)) {
      this.suggestions.push({
        type: 'constant',
        text: scope.name,
        description: `${enumName}.${scope.name}`
      })
      return false
    }
    return !['namespace', 'class', 'enum'].includes(scope.type)
  }

  suggestNamespaces (scope, file, line, prefix, addSemiColumn) {
    if (scope.type === 'namespace' && (scope.qualifiedName.startsWith(prefix) || prefix === ' ')) {
      this.suggestions.push({
        type: 'import',
        text: `${scope.qualifiedName}${addSemiColumn ? ';' : ''}`,
        displayText: scope.qualifiedName,
        description: `From ${path.basename(file.path)}`
      })
      return false
    }
    return true
  }

  suggestErrors (scope, file, line, prefix) {
    if (scope.type === 'error-domain' && scope.name.startsWith(prefix)) {
      if (scope.parent.type === 'namespace') {
        if (this.currentFile.usingDirectives.includes(scope.parent.qualifiedName)) {
          for (const val of scope.children) {
            this.suggestions.push({
              type: 'error',
              iconHTML: '<i class="icon-stop"></i>',
              snippet: `${scope.name}.${val.name} ("\${1}");`,
              displayText: `${scope.name}.${val.name}`,
              description: val.qualifiedName
            })
          }
        } else {
          for (const val of scope.children) {
            this.suggestions.push({
              type: 'error',
              iconHTML: '<i class="icon-stop"></i>',
              snippet: `${val.qualifiedName} ("\${1}");`,
              displayText: val.qualifiedName,
              description: `Or ${scope.name}.${val.name} if you add 'using ${scope.parent.qualifiedName}'`
            })
          }
        }
      } else {
        for (const val of scope.children) {
          this.suggestions.push({
            type: 'error',
            iconHTML: '<i class="icon-stop"></i>',
            snippet: `${scope.name}.${val.name} ("\${1}");`,
            displayText: `${scope.name}.${val.name}`,
            description: val.qualifiedName
          })
        }
      }

      return false
    }

    return !['namespace', 'class'].includes(scope.type)
  }

  suggestClasses (scope, file, line, prefix) {
    if (scope.type && scope.type === 'class' && (scope.name.startsWith(prefix) || scope.qualifiedName.startsWith(prefix))) {
      if (scope.parent.type === 'namespace') {
        if (this.currentFile.usingDirectives.includes(scope.parent.qualifiedName) && scope.name.startsWith(prefix)) {
          this.suggestions.push({
            type: 'class',
            text: scope.name,
            description: scope.qualifiedName
          })
        } else {
          this.suggestions.push({
            type: 'class',
            text: scope.qualifiedName,
            description: `Or ${scope.name}, if you add 'using ${scope.parent.qualifiedName}'`
          })
        }
      } else if (scope.parent && !scope.parent.type) {
        this.suggestions.push({
          type: 'class',
          text: scope.name,
          description: scope.qualifiedName
        })
      }

      return false
    } else if (scope.type && scope.type === 'namespace') {
      return false
    }
    return true
  }

  suggestThis (scope, file, line, prefix) {
    if (scope.parent === this.getThis() && (scope.name.startsWith(prefix) || prefix === '.')) {
      this.suggestions.push({
        type: 'method',
        text: scope.name,
        description: scope.qualifiedName
      })
      return true
    }
    return false
  }

  suggestKeywords (prefix) {
    if (prefix !== '' && this.currentScope) {
      let type = this.currentScope.type
      if ((type === 'method' || type === 'constructor') && this.currentScope.parent) {
        type = this.currentScope.parent.type + '.' + type
      }
      for (const kw of keywords) {
        if ((kw.scope.split(', ').includes(type) || !type) && kw.name.startsWith(prefix)) {
          this.suggestions.unshift({
            snippet: kw.completion,
            displayText: kw.name,
            type: 'keyword',
            description: kw.description ? kw.description : `The ${kw.name} keyword.`
          })
        }
      }
    }
  }

  suggestSnippets (prefix) {
    for (const snippet of snippets) {
      if (snippet.prefix.includes(prefix) && prefix !== '' && prefix !== ' ') {
        this.suggestions.push({
          snippet: snippet.content,
          displayText: snippet.prefix,
          type: 'snippet',
          description: snippet.name
        })
      }
    }
  }

  getThis () {
    let scope = this.currentScope
    while (scope.type !== 'class' || scope !== 'interface' && scope.parent) {
      scope = scope.parent
    }
    return scope
  }
}
