'use babel'

export default class TypeFinder {
  constructor (scopes) {
    this.scopes = scopes
  }

  getExpressionType (expr, context) {

  }

    /**
    * name: Gee.ArrayList (no generics)
    * context : {
    *   usings: [ 'GLib', 'Gee', ... ]
    * }
    */
  getTypeFromName (name, context) {
    if (typeof name !== 'string') {
      throw new Error('name should be a string')
    }

    const identifiers = name.split('.')
    const noExplore = [ 'property', 'method', 'ctor', 'signal' ]
    let i = 0
    let res = null
    const explore = (scope) => {
      if (!scope.data || noExplore.includes(scope.data.type)) {
        return
      }

      if (scope.data.name || scope.data.type === 'global') {
        if (scope.data.name === identifiers[i] || scope.data.type === 'global') {
          if (i === identifiers.length - 1) {
            res = scope
            return
          }

          i++
          for (const child of scope.children) {
            explore(child)
          }
        }
      }
    }

    for (const top of this.scopes) {
      explore(top)
    }

    return res

        // parsing and removing generics
    let generics = []
    if (typeof type === 'string') {
      let newType = ''
      let genericLevel = 0
      let genericCount = 0
      for (const ch of type) {
        if (ch === '<') { genericLevel++ }

        if (genericLevel === 0) {
          newType += ch
        } else {
          if (ch === ',') { genericCount++; continue }

          if (!generics[genericCount]) { generics[genericCount] = '' }

          generics[genericCount] += ch
        }

        if (ch === '>') { genericLevel-- }
      }
      generics = generics.map((gen) => {
        let res = ''
        let i = -1
        for (const char of gen.trim()) {
          i++
          if ((char === '<' && i === 0) || (char === '>' && i >= gen.length - 2)) continue
          res += char
        }
        return res
      }).map((gen) => {
        const ret = this.getType(gen, undefined, usings)
        return ret
      })
      type = newType
    }

        // removing method's parameters and spaces
    while (expr && expr.match(this.re.par)) {
      expr = expr.replace(this.re.par, '')
      expr = expr.replace(' ', '')
    }

    if (typeof type === 'string') {
            // TODO : support arrays[]

      let res
      let nsName
      let shortTypeName = type
      if (type.includes('.')) {
        const typeParts = type.split('.')
        nsName = typeParts.slice(0, typeParts.length - 1).join('.')
        shortTypeName = typeParts[typeParts.length - 1]
      }

      let ns
      let explore = (scope, everything) => {
        if (!scope.data) { return }

        if (scope.data.type === 'global' || scope.data.type === 'namespace') {
          if (!everything) {
                        // search only in used namespaces or specified namespace
            if (nsName && scope.data.name === nsName) { // TODO : support nested namespaces
              ns = scope
              for (ch of scope.children) {
                explore(ch, everything)
              }
            } else if (!nsName && usings.includes(scope.data.name)) { // TODO : support nested namespaces
              ns = scope
              for (ch of scope.children) {
                explore(ch, everything)
              }
            } else if (scope.data.type === 'global') {
              for (ch of scope.children) {
                explore(ch, everything)
              }
            }
          } else {
            for (ch of scope.children) {
              explore(ch, everything)
            }
          }
        } else if (scope.data.type === 'class' || scope.data.type === 'interface' || scope.data.type === 'struct') {
          if (scope.data.name === shortTypeName) {
            res = scope
          }
        }
      }

      for (child of this.scopes) {
        explore(child, false)
      }

            // if nothing is found, we search everywhere
      if (!res) {
        for (child of this.scopes) {
          explore(child, true)
        }
      }

      if (!expr) {
        return {
          base: res,
          generics: generics
        }
      } else {
        return {
          base: this.getType(res, expr, usings),
          generics: generics
        }
      }
    } else if (type) {
            // we have got a scope

      if (expr.includes('.')) {
        let t = type
        for (subExpr in expr.split('.')) {
          t = this.getType(t, subExpr, usings)
        }
        return t
      } else {
        for (ch of type.children) {
          if (ch.data && ch.data.name === expr) {
            return this.getType(ch.data.valueType ? ch.data.valueType : ch.data.returnType, '', usings) // return scope, not name
          }
        }
      }
    } else {
      return {
        data: {
          name: 'void'
        }
      }
    }
  }
}
