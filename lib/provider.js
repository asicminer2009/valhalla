'use babel'

export default class ValaProvider {
  constructor (scopes) {
    this.re = {
      using: /^using /,
      usingLine: /^using (.*);/,
      newInstance: /^(const )?([\w]+(<([\w, ]+)>)?) ([\w]+) = new $/,
      par: /\(.*\)/,
      escapePrefix: /[-[\]/{}()*+?.\\^$|]/g,
      thisMember: /this\./,
      tis: /this/
    }

    this.scopes = scopes

        // autocomplete-plus properties
    this.selector = '.source.vala'
    this.disableForSelector = '.source.vala .comment, .source.vala .string'
    this.inclusionPriority = 10
    this.excludeLowerPriority = true
  }

  getSuggestions ({editor, bufferPosition, scopeDescriptor, prefix, activatedManually}) {
    this.scopes.sort((a, b) => {
      if (a.vapi && !b.vapi) {
        return -1
      }

      if (b.vapi && !a.vapi) {
        return 1
      }

      return 0
    })
    let line = editor.getTextInRange([[bufferPosition.row, 0], bufferPosition])
    let usings = ['GLib']
    for (const ln of editor.getText().split('\n')) {
      let usingMatch = ln.match(this.re.usingLine)
      if (usingMatch) {
        usings.push(usingMatch[1])
      }
    }

    return new Promise((resolve) => {
      let suggestions = []
      let thisScope
      const trimLine = line.trim()

            // matches
      const newMatch = (trimLine.replace('new ' + prefix, '').trim() + ' new ').match(this.re.newInstance)
      if (newMatch && newMatch[3]) { // remove generics
        newMatch[2] = newMatch[2].replace(newMatch[3], '')
      }

      const shouldSuggestTypes = trimLine.startsWith('public ') || trimLine.startsWith('private ') || trimLine.endsWith((prefix.endsWith('<') ? '' : '<') + prefix)
      const shouldSuggestClasses = trimLine.length === 0 || (trimLine[0] === trimLine[0].toUpperCase() && trimLine === prefix) || shouldSuggestTypes
      const shouldSuggestStructs = trimLine === prefix || trimLine === 'const ' + (prefix === ' ' ? '' : prefix) || shouldSuggestTypes
      const shouldSuggestInherits = (trimLine.includes('class ') || trimLine.includes('interface ')) && trimLine.includes(' : ')

            // explores a scopes and get suggestions from it, if needed
      const explore = (scope) => {
                // determining scope corresponding to `this`
        if (scope.file === editor.getPath() && scope.at[0][0] <= bufferPosition.row && scope.at[1][0] >= bufferPosition.row + 1) {
          if (!thisScope && scope.data && scope.data.type === 'class') {
            thisScope = scope
          }
        }

                // Suggesting classes or interfaces
        if (shouldSuggestClasses) {
                    // first letter is a capital letter
          if (scope.data && (scope.data.type === 'class' || scope.data.type === 'interface') && scope.data.name.startsWith(prefix)) {
            let suggestion = {
              snippet: scope.data.name + (scope.data.generics ? '<' + scope.data.generics.map((el, index) => {
                return '${' + (index + 1) + ':' + el + '}'
              }).join(', ') + '>' : '') + ' $42', // please don't write type with more than 41 generics arguments
              type: scope.data.type,
              description: `The ${scope.data.name} ${scope.data.type}.`,
              priority: 100
            }
            suggestions.push(suggestion)
          }
        }

                // suggest classes and interface from which you can inherits
        if (shouldSuggestInherits) {
          if (scope.data && (scope.data.type === 'class' || scope.data.type === 'interface') && (scope.data.name.startsWith(prefix) || prefix === ' ')) {
            const suggestion = {
              text: scope.data.name,
              displayText: scope.data.name,
              type: scope.data.type,
              priority: 100
            }
            suggestions.push(suggestion)
          }
        }

                // suggest structs
        if (shouldSuggestStructs) {
          if (scope.data && scope.data.type === 'struct' && scope.data.name.startsWith(prefix)) {
            suggestions.push({
              type: 'struct',
              text: scope.data.name + ' ',
              displayText: scope.data.name,
              description: `The ${scope.data.name} struct.`,
              priority: 99
            })
          }
        }

                // for instance :
                // Value v =
                // will show `Value`
                // TODO : don't show it if there is a [*Type] attribute([IntegerType], [BooleanType] ...) because we write literal value for these types
        if (scope.data && scope.data.type === 'struct' && trimLine.endsWith(' =' + (prefix === ' ' ? '' : ' ' + prefix)) && trimLine.split(' ')[0] === scope.data.name) {
          suggestions.push({
            type: 'struct',
            snippet: scope.data.name + '($1);',
            displayText: scope.data.name
          })
        }

                // creating new instances
        if (newMatch) {
                    // TODO : give priority to classes in used namespaces
                    // TODO : make this line looking less encrypted
          if (scope.data && scope.data.type === 'class' && (scope.data.name === newMatch[2] || (scope.data.inherits.length && scope.data.inherits.map((elt) => {
            let splitted = elt.split('.'); return splitted[splitted.length - 1]
          }).includes(newMatch[2])))) {
            for (const ch of scope.children) {
              if (ch.data && ch.data.type === 'ctor') {
                const suggestion = this.suggestMethod(ch, this.getType(newMatch[2], '', usings).generics)

                if (prefix === ' ' || suggestion.displayText.match(prefix)) {
                  suggestions.push(suggestion)
                }
              }
            }
          }
        }

                    // we also suggest instance properties/methods for these variables
          if (trimLine.endsWith(prefix === '.' ? '.' : '.' + prefix)) {
            let parCount = 0
            for (let i = trimLine.length - 1; i >= 0; i--) {
              // TODO : ignore literals
              const ch = trimLine[i]
              if (ch === '(') parCount++
              if (ch === ')') parCount--
              if (parCount === 1 || ch === '=' || i === 0) {
                // we are at the beginning of the current expression
                let expr = trimLine.slice(i, trimLine.length).replace('=', '').trim()
                if (expr.endsWith('.')) {
                  expr = expr.slice(0, expr.length - 1)
                }
                const splitExpr = expr.split('.')
                for (const localVar of scope.vars) {
                  if (localVar.name === splitExpr[0]) {
                    const type = this.getType(localVar.type, splitExpr.slice(1, splitExpr.length - 1).join('.'), usings)
                    for (const member of type.base.children) {
                      if (member.data && member.data.name && (member.data.name.startsWith(prefix) || prefix === '.')) {
                        switch (member.data.type) {
                          case 'method':
                            suggestions.push(this.suggestMethod(member, type.generics))
                            break
                          case 'property':
                            suggestions.push(this.suggestProperty(member, type.generics))
                            break
                          default:
                            break
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

                // member of this
        if (thisScope && line.endsWith(scope.data && scope.data.name && 'this' + (prefix === '.' ? prefix : '.' + prefix)) && scope.top === thisScope && scope.data.type !== 'ctor' && scope.data.name.match(prefix === '.' ? /.*/ : prefix)) {
          switch (scope.data.type) {
            case 'method':
              suggestions.unshift(this.suggestMethod(scope))
              break
            case 'property':
              suggestions.unshift(this.suggestProperty(scope))
              break
            default:
              break
          }
        }

                // enumerations
        if (scope.data && scope.data.type === 'enum') {
          const restOfLine = trimLine.replace(prefix, '')
          const skip = !(restOfLine.endsWith('(') || restOfLine.endsWith('= ') || restOfLine.endsWith(', ') || restOfLine.endsWith(scope.data.name + (prefix === '.' ? '' : '.')))
          const valuesPrefix = scope.data.name + (prefix === '.' ? '.' : '.' + prefix)
          const wantValues = trimLine.endsWith(valuesPrefix)
                    // TODO : show enums only when really needed
          if (!skip && scope.data.name.startsWith(prefix) && !wantValues) {
            suggestions.push({
              text: scope.data.name,
              type: 'enum',
              description: `The ${scope.data.name} enum.`
            })
          } else if (!skip && wantValues) {
            for (const val of scope.data.values) {
              if (val.trim().startsWith(prefix) || prefix === '.') {
                suggestions.push({
                  text: val.trim(),
                  type: 'value'
                })
              }
            }
          }
        }
      }
    })
  }

  suggestMethod (scope, generics) {
    if (!(scope.data && (scope.data.type === 'method' || scope.data.type === 'ctor'))) return

    let snip = scope.data.name + ' ('
    let htmlParams = []
    let count = 1
    let paramList = []
    if (scope.data.parsedParameters) {
      for (const param of scope.data.parsedParameters) {
        if (!param.type || !param.name) continue
        htmlParams.push((param.modifier ? `<span class="storage modifier vala">${param.modifier}</span> ` : '') +
                    `<span class="storage type vala">${param.type}</span> ` +
                    `<span class="variable parameter vala">${param.name}</span>`
                )
        paramList.push((param.modifier ? param.modifier + ' ' : '') + '${' + count + ':' + param.name + '}')
        count++
      }
    }
    snip += paramList.join(', ')
    snip += ');$' + count

    let returnType = (scope.data.returnType ? ((scope.data.modifier === 'static' ? 'static ' : '') + scope.data.returnType) : '')
    if (scope.top && scope.top.data && scope.top.data.generics) {
      let i = 0
      for (const gen of scope.top.data.generics) {
        returnType = returnType.replace('<' + gen + '>', '<' + generics[i].base.data.name + '>')
        if (returnType === gen) { returnType = generics[i].base.data.name }
        i++
      }
    }

    const suggestion = {
      snippet: snip,
      type: scope.data.type === 'method' ? 'method' : 'class',
      displayText: scope.data.name,
      leftLabel: returnType,
      rightLabelHTML: htmlParams.length ? htmlParams.join(', ') : '',
      description: scope.documentation.short ? scope.documentation.short : (scope.data.type === 'method' ? `The ${scope.data.name} method.` : `Creates a new instance of ${scope.top.data.name}.`)
    }

    return suggestion
  }

  suggestProperty (scope) {
    if (scope.data && scope.data.type === 'property') {
      return {
        text: scope.data.name,
        leftLabel: (scope.data.modifier === 'static' ? '(static) ' : '') + scope.data.valueType,
        type: 'property',
        description: `The ${scope.data.name} property.`
      }
    }
  }
}
