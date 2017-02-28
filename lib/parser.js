'use babel'

import {report} from './valhalla'
import * as path from 'path'

/**
* A parser for Vala. To use in combination with a ValaLexer
*/
export default class ValaParser {
  constructor (tokens, path) {
    this.tokens = this.preprocess(tokens)
    this.index = 0
    this.path = path
    this.isVapi = path.endsWith('.vapi')
  }

  /**
  * Returns the current token
  */
  get current () {
    const limit = 20
    if (this.tokens[this.index]) {
      return this.tokens[this.index]
    } else if (this.tokens.length >= this.index - limit) {
      if (this.index - this.tokens.length !== 0) {
        console.warn(`Out of tokens of ${this.index - this.tokens.length}`)
      }
      return {
        type: 'end-of-file',
        lexeme: 'EOF',
        line: this.tokens[this.tokens.length - 1].line,
        column: this.tokens[this.tokens.length - 1].column
      }
    } else {
      throw new Error(`Unexpected end of file (no token at ${this.index}, file ${path.basename(this.path)} ends at ${this.tokens.length})`)
    }
  }

  /**
  * Returns the previous token
  */
  get previous () {
    this.index--
    const res = this.current
    this.index++
    return res
  }

  /**
  * Return the last parsed attributes
  */
  get attributes () {
    const attrs = this._attributes
    this.attributes = null
    return attrs
  }

  set attributes (val) {
    this._attributes = val
  }

  get position () {
    return {
      line: this.current.line,
      column: this.current.column
    }
  }

  /**
  * Transforms tokens into an AST
  */
  parse () {
    this.file = {
      path: this.path,
      usingDirectives: ['GLib'],
      children: [],
      type: 'file',
      lookup: (qualifName) => {
        let scope = null
        this.file.explore(scp => {
          if (scp.qualifiedName === qualifName) {
            scope = scp
            return true
          }
        })
        return scope
      },
      explore: (cb) => {
        const exp = (scope) => {
          const stop = cb(scope)
          if (!stop && scope.children) {
            for (const child of scope.children) {
              exp(child)
            }
          }
        }

        for (const scope of this.file.children) {
          exp(scope)
        }
      }
    }

    try {
      this.parseRoot()
    } catch (e) {
      this.error(e.message)
      return false
    }

    return true
  }

  /**
  * Reports an error
  */
  error (msg) {
    report.error(msg, this.current.line, [this.current.column, this.current.column + this.current.lexeme.length], this.path)
  }

  warn (msg) {
    if ((this.isVapi && atom.config.get('valhalla.warnVapi')) || !this.isVapi) {
      report.warning(msg, this.current.line, [this.current.column, this.current.column + this.current.lexeme.length], this.path)
    }
  }

  next () {
    this.index++
    if (this.tokens[this.index] && (this.current.type === 'multiline-comment-begin' || this.current.type === 'single-line-comment')) {
      this.parseComments()
    }
  }

  /**
  * Moves on if the current token is a `type`
  */
  accept (type) {
    try {
      if (this.current.type === type) {
        this.next()
        return true
      }
      return false
    } catch (e) {
      return false
    }
  }

  /**
  * Moves on if the current token is a `type`, fails if it isn't
  */
  expect (type, name = type) {
    if (this.accept(type)) {
      return true
    } else {
      throw new Error(`Expected ${name}, but got ${this.current.lexeme}`)
    }
  }

  qualifiedName (parent, basename) {
    if (parent.qualifiedName) {
      return parent.qualifiedName + '.' + basename
    } else {
      return basename
    }
  }

  parseComments () {
    let comm = ''
    if (this.accept('multiline-comment-begin')) {
      let atEnd = false
      while (!atEnd) {
        switch (this.current.type) {
          case 'multiline-comment':
            comm += this.current.lexeme
            break
          case 'line-break':
            comm += '\n'
            break
          case 'multiline-comment-end':
            atEnd = true
            break
          default:
            this.error(`Unexpected token in comment : ${this.current.type}`) // should not be reached
        }
        this.next()
      }
    }

    if (this.current.type === 'single-line-comment') {
      do {
        comm = [comm, this.current.lexeme].join('\n') // to join comments with line breaks
      } while (this.accept('single-line-comment'))
    }
    if (comm) {
      const begin = this.index
      const nextComms = this.parseComments() // We parse multiline comments again, and then single line
      if (nextComms) {
        comm = [comm, nextComms].join('\n\n')
      } else {
        this.index = begin
      }
    }
    return comm === '' ? null : comm
  }

  parseRoot () {
    this.file.documentation = this.parseComments()
    this.parseUsings(this.file)
    this.parseNs(this.file)
    this.expect('end-of-file')
  }

  parseUsings (parent) {
    while (this.accept('using-keyword')) {
      const ns = this.getIdentifier()
      if (parent.usingDirectives.includes(ns)) {
        this.warn('Duplicate using directive')
      }
      parent.usingDirectives.push(ns)
      this.expect('semi-colon', 'a semicolon')

      this.parseComments()
    }
  }

  parseNsDecl (parent) {
    const ns = {
      children: [],
      type: 'namespace',
      parent: parent,
      position: {
        begin: this.position
      }
    }
    ns.attributes = this.attributes
    ns.documentation = this.parseComments()

    this.expect('namespace-keyword')
    ns.name = this.getIdentifier()
    ns.qualifiedName = this.qualifiedName(parent, ns.name)

    this.expect('left-brace')
    this.parseNs(ns)
    ns.position.end = this.position
    this.expect('right-brace')
    parent.children.push(ns)
  }

  parseNs (ns) {
    let begin = -1
    while (this.current.type !== (ns === this.file ? 'end-of-file' : 'right-brace')) {
      switch (this.current.type) {
        case 'multiline-comment-begin':
        case 'private-keyword':
        case 'internal-keyword':
        case 'protected-keyword':
        case 'public-keyword':
        case 'static-keyword':
        case 'abstract-keyword':
        case 'async-keyword':
        case 'const-keyword':
        case 'unowned-keyword':
        case 'owned-keyword':
        case 'left-parenthese':
          begin = begin === -1 ? this.index : begin
          this.next()
          break
        case 'left-square-brace':
          this.parseAttributes()
          break
        case 'class-keyword':
          this.index = begin === -1 ? this.index : begin
          this.parseClassDecl(ns)
          begin = -1
          break
        case 'interface-keyword':
          this.index = begin === -1 ? this.index : begin
          this.parseIfaceDecl(ns)
          begin = -1
          break
        case 'struct-keyword':
          this.index = begin === -1 ? this.index : begin
          this.parseStructDecl(ns)
          begin = -1
          break
        case 'enum-keyword':
          this.index = begin === -1 ? this.index : begin
          this.parseEnumDecl(ns)
          begin = -1
          break
        case 'errordomain-keyword':
          this.index = begin === -1 ? this.index : begin
          begin = -1
          this.parseErrorDomainDecl(ns)
          begin = -1
          break
        case 'delegate-keyword':
          this.index = begin === -1 ? this.index : begin
          this.parseDelegateDecl(ns)
          begin = -1
          break
        case 'signal-keyword':
          this.index = begin === -1 ? this.index : begin
          this.parseSignalDecl(ns)
          begin = -1
          break
        case 'namespace-keyword':
          this.parseNsDecl(ns)
          begin = -1
          break
        case 'identifier':
          this.index = begin === -1 ? this.index : begin
          this.parseMember(ns)
          begin = -1
          break
        case 'multiline-comment':
        case 'multiline-comment-end':
        case 'single-line-comment':
        case 'line-break':
          this.next() // Ignore them
          break
        default:
          throw new Error(`Unexpected token ${this.current.lexeme} (${this.current.type})`)
      }
    }
  }

  parseClassDecl (parent) {
    const cls = {
      type: 'class',
      children: [],
      parent: parent,
      position: {
        begin: this.position
      }
    }
    cls.documentation = this.parseComments()
    this.parseAttributes()
    cls.attributes = this.attributes
    cls.visibility = this.getVisibility()
    cls.isAbstract = this.accept('abstract-keyword')
    this.expect('class-keyword')
    cls.name = this.getIdentifier()
    cls.qualifiedName = this.qualifiedName(parent, cls.name)
    cls.generics = this.getGenerics()

    if (this.accept('colon')) { // inherance
      const base = this.getType()
      if (base) {
        cls.inherance = []
        cls.inherance.push(base)
        while (this.accept('comma')) {
          const otherBase = this.getType()
          if (otherBase) {
            cls.inherance.push(otherBase)
          } else {
            this.error('Expected class or interface name')
          }
        }
      } else {
        this.error('Expected class or interface name')
      }
    }

    this.expect('left-brace', 'a { to begin the class body')
    this.parseClass(cls)
    cls.position.end = this.position
    this.expect('right-brace', 'the end of the class body')
    parent.children.push(cls)
  }

  parseClass (cls) {
    let begin = -1
    while (this.current.type !== 'right-brace') {
      switch (this.current.type) {
        case 'multiline-comment-begin':
        case 'private-keyword':
        case 'internal-keyword':
        case 'protected-keyword':
        case 'public-keyword':
        case 'static-keyword':
        case 'abstract-keyword':
        case 'virtual-keyword':
        case 'new-keyword':
        case 'override-keyword':
        case 'async-keyword':
        case 'const-keyword':
        case 'unowned-keyword':
        case 'owned-keyword':
        case 'weak-keyword':
          begin = begin === -1 ? this.index : begin
          this.next()
          break
        case 'left-square-brace':
          this.parseAttributes()
          break
        case 'class-keyword':
          // if the class keyword is here as a modifier, we should be able to get two identifier after (type and name of the member)
          let isClassModifier = true
          try {
            this.next() // consume `class` that could be considered as an identifier
            this.getType()
            this.getIdentifier()
          } catch (err) {
            isClassModifier = false
          }
          this.index = begin === -1 ? this.index : begin
          if (isClassModifier) {
            this.parseMember(cls)
          } else {
            this.parseClassDecl(cls)
          }
          begin = -1
          break
        case 'struct-keyword':
          this.index = begin === -1 ? this.index : begin
          this.parseStructDecl(cls)
          begin = -1
          break
        case 'enum-keyword':
          this.index = begin === -1 ? this.index : begin
          this.parseEnumDecl(cls)
          begin = -1
          break
        case 'left-parenthese':
        case 'global-keyword':
        case 'identifier':
        case 'at':
          this.index = begin === -1 ? this.index : begin
          this.parseMember(cls)
          begin = -1
          break
        case 'delegate-keyword':
          this.index = begin === -1 ? this.index : begin
          this.parseDelegateDecl(cls)
          begin = -1
          break
        case 'signal-keyword':
          this.index = begin === -1 ? this.index : begin
          this.parseSignalDecl(cls)
          begin = -1
          break
        case 'multiline-comment':
        case 'multiline-comment-end':
        case 'single-line-comment':
        case 'line-break':
          this.next() // Ignore them
          break
        default:
          throw new Error(`Unexpected token ${this.current.lexeme}`)
      }
    }
  }

  parseStructDecl (parent) {
    const str = {
      type: 'struct',
      children: [],
      parent: parent
    }

    str.documentation = this.parseComments()
    this.parseAttributes()
    str.attributes = this.attributes
    str.visibility = this.getVisibility()
    this.expect('struct-keyword')
    str.name = this.getIdentifier()
    str.qualifiedName = this.qualifiedName(parent, str.name)
    str.generics = this.getGenerics()

    if (this.accept('colon')) {
      str.inherance = [
        this.getIdentifier()
      ]
    }

    this.expect('left-brace')
    this.parseStruct(str)
    this.expect('right-brace')

    parent.children.push(str)
  }

  parseStruct (str) {
    let begin = -1
    while (this.current.type !== 'right-brace') {
      switch (this.current.type) {
        case 'multiline-comment-begin':
        case 'private-keyword':
        case 'internal-keyword':
        case 'protected-keyword':
        case 'public-keyword':
        case 'static-keyword':
        case 'async-keyword':
        case 'const-keyword':
        case 'unowned-keyword':
        case 'owned-keyword':
        case 'weak-keyword':
          begin = begin === -1 ? this.index : begin
          this.next()
          break
        case 'left-square-brace':
          this.parseAttributes()
          break
        case 'global-keyword':
        case 'identifier':
          this.index = begin === -1 ? this.index : begin
          this.parseMember(str)
          begin = -1
          break
        case 'multiline-comment':
        case 'multiline-comment-end':
        case 'single-line-comment':
        case 'line-break':
          this.next() // Ignore them
          break
        default:
          console.log('struct err', str)
          throw new Error(`Unexpected token ${this.current.lexeme}`)
      }
    }
  }

  parseIfaceDecl (parent) {
    const iface = {
      type: 'interface',
      children: [],
      parent: parent
    }
    iface.documentation = this.parseComments()
    iface.visibility = this.getVisibility()
    this.expect('interface-keyword')
    iface.name = this.getIdentifier()
    iface.qualifiedName = this.qualifiedName(parent, iface.name)
    iface.generics = this.getGenerics()

    if (this.accept('colon')) { // inherance
      const base = this.getType()
      if (base) {
        iface.inherance = []
        iface.inherance.push(base)
        while (this.accept('comma')) {
          const otherBase = this.getType()
          if (otherBase) {
            iface.inherance.push(otherBase)
          } else {
            this.error('Expected class or interface identifier')
          }
        }
      } else {
        this.error('Expected class or interface identifier')
      }
    }

    this.expect('left-brace', 'a { to begin the interface body')
    this.parseClass(iface)
    this.expect('right-brace', 'the end of the interface')
    // TODO: parse members
    parent.children.push(iface)
  }

  parseDelegateDecl (parent) {
    const dlg = {
      type: 'delegate',
      parent: parent
    }
    dlg.documentation = this.parseComments()
    this.parseAttributes()
    dlg.attributes = this.attributes
    dlg.visibility = this.getVisibility()
    this.expect('delegate-keyword')
    dlg.isUnowned = this.accept('unowned-keyword')
    if (!dlg.isUnowned) {
      dlg.isOwned = this.accept('owned-keyword')
    }
    dlg.returnType = this.getType()
    dlg.name = this.getIdentifier()
    dlg.qualifiedName = this.qualifiedName(parent, dlg.name)

    dlg.generics = this.getGenerics()

    this.expect('left-parenthese')

    dlg.parameters = []
    let firstParam = true
    while (!this.accept('right-parenthese')) {
      if (firstParam) {
        firstParam = false
      } else {
        this.expect('comma')
      }

      const param = {}
      if (this.accept('ellipsis')) {
        param.isVaList = true
      } else {
        this.parseAttributes()
        param.attributes = this.attributes

        if (this.accept('out-keyword')) {
          param.out = true
        } else if (this.accept('ref-keyword')) {
          param.ref = true
        }
        param.isUnowned = this.accept('unowned-keyword')
        if (!param.isUnowned) {
          param.isOwned = this.accept('owned-keyword')
        }
        param.valueType = this.getType()
        param.name = this.getIdentifier()

        if (this.accept('equal')) {
          // TODO: stop skipping it
          let level = 0
          while (this.current.type !== 'comma') {
            if (this.current.type === 'left-parenthese') {
              level++
            }
            if (this.current.type === 'right-parenthese') {
              level--
              if (level <= 0) {
                break
              }
            }
            this.next()
          }
        }
      }

      dlg.parameters.push(param)
    }

    if (this.accept('throws-keyword')) {
      dlg.throws = []
      while (true) {
        dlg.throws.push(this.getIdentifier())
        if (!this.accept('comma')) {
          break
        }
      }
    }

    this.expect('semi-colon')

    parent.children.push(dlg)
  }

  parseSignalDecl (parent) {
    const sig = {
      type: 'signal',
      parent: parent
    }
    this.parseAttributes()
    sig.attributes = this.attributes
    sig.documentation = this.parseComments()
    sig.visibility = this.getVisibility()
    sig.isStatic = this.accept('static-keyword') || parent.type === 'namespace'
    sig.isAbstract = this.accept('abstract-keyword')
    if (!sig.isAbstract && (parent.type === 'class' || parent.type === 'interface')) {
      sig.isVirtual = this.accept('virtual-keyword')
    }
    sig.isOverride = this.accept('override-keyword')
    if (!sig.isOverride) {
      sig.isNew = this.accept('new-keyword')
    }

    sig.isAsync = this.accept('async-keyword')

    this.expect('signal-keyword')

    sig.isUnowned = this.accept('unowned-keyword')
    if (!sig.isUnowned) {
      sig.isOwned = this.accept('owned-keyword')
    }

    sig.returnType = this.getType()
    sig.name = this.getIdentifier()
    sig.qualifiedName = this.qualifiedName(parent, sig.name)
    sig.generics = this.getGenerics()

    this.expect('left-parenthese')
    sig.parameters = []
    let firstParam = true
    while (!this.accept('right-parenthese')) {
      if (firstParam) {
        firstParam = false
      } else {
        this.expect('comma')
      }

      const param = {}
      if (this.accept('ellipsis')) {
        param.isVaList = true
      } else {
        this.parseAttributes()
        param.attributes = this.attributes

        if (this.accept('out-keyword')) {
          param.out = true
        } else if (this.accept('ref-keyword')) {
          param.ref = true
        }
        param.isOwned = this.accept('owned-keyword')
        param.valueType = this.getType()
        param.name = this.getIdentifier()

        if (this.accept('equal')) {
          // TODO: stop skipping it
          let level = 0
          while (!(this.current.type === 'comma' || (this.current.type === 'right-parenthese' && level === 0))) {
            if (this.current.type === 'left-parenthese') {
              level++
            }
            if (this.current.type === 'right-parenthese') {
              level--
            }
            this.next()
          }
        }
      }

      sig.parameters.push(param)
    }

    if (this.accept('throws-keyword')) {
      sig.throws = []
      while (true) {
        sig.throws.push(this.getIdentifier())
        if (!this.accept('comma')) {
          break
        }
      }
    }

    this.expect('semi-colon')

    parent.children.push(sig)
  }

  parseMember (parent) {
    const doc = this.parseComments()
    const begin = this.index
    let determined = false
    while (!determined) {
      switch (this.current.type) {
        case 'left-brace':
          if (parent.type === 'namespace' || parent.type === 'struct') {
            this.error(`Properties are not allowed in ${parent.type}s. Use fields instead.`, this.current.line, this.current.column, this.path)
          }
          this.index = begin
          this.parsePropertyDecl(parent, doc)
          determined = true
          break
        case 'left-parenthese':
          this.index = begin
          this.parseMethodDecl(parent, doc)
          determined = true
          break
        case 'semi-colon':
          this.index = begin
          this.parseField(parent, doc)
          determined = true
          break
        default:
          this.next()
      }
    }
  }

  parseEnumDecl (parent) {
    const enm = {
      type: 'enum',
      children: [],
      parent: parent
    }
    enm.documentation = this.parseComments()
    this.parseAttributes()
    enm.attributes = this.attributes
    enm.visibility = this.getVisibility()
    this.expect('enum-keyword')
    enm.name = this.getIdentifier()
    enm.qualifiedName = this.qualifiedName(parent, enm.name)
    this.expect('left-brace', 'a { to begin enumeration')

    this.parseEnum(enm)

    parent.children.push(enm)
  }

  parseErrorDomainDecl (parent) {
    const errd = {
      type: 'error-domain',
      children: [],
      parent: parent
    }
    errd.documentation = this.parseComments()
    this.parseAttributes()
    errd.attributes = this.attributes
    errd.visibility = this.getVisibility()
    this.expect('errordomain-keyword')
    errd.name = this.getIdentifier()
    errd.qualifiedName = this.qualifiedName(parent, errd.name)
    this.expect('left-brace', 'a { to begin error domain')

    this.parseEnum(errd)

    parent.children.push(errd)
  }

  parseEnum (enm) {
    let hasMethods = false
    while (true) {
      if (this.current.type === 'identifier' || this.current.type === 'at' || this.current.type === 'integer-literal') {
        const val = {
          name: this.getIdentifier(),
          type: enm.type + '-value', // we can have enum-value and error-domain-value
          attributes: this.attributes,
          parent: enm
        }
        val.qualifiedName = this.qualifiedName(enm, val.name)

        if (this.accept('equal')) {
          val.value = this.current.lexeme
          this.expect('integer-literal')
        }

        if (this.accept('comma')) {
          enm.children.push(val)
          if (this.accept('right-brace')) { // sometimes people puts nothing after their last comma.
            break
          }
        } else if (this.accept('semi-colon')) {
          enm.children.push(val)
          hasMethods = true
          break
        } else if (this.accept('right-brace')) {
          enm.children.push(val)
          break
        } else {
          console.log('enum err', val, enm)
          throw new Error(`Unexpected token ${this.current.type} (expected comma, semi-colon or closing brace)`)
        }
      } else if (this.current.type === 'left-square-brace') {
        this.parseAttributes()
      } else {
        throw new Error(`Unexpected ${this.current.type}`)
      }
    }

    if (hasMethods) {
      let begin = -1
      while (true) {
        if (this.accept('right-brace')) {
          break
        } else {
          switch (this.current.type) {
            case 'public-keyword':
            case 'private-keyword':
            case 'internal-keyword':
            case 'static-keyword':
            case 'unowned-keyword':
              begin = begin === -1 ? this.index : begin
              this.next()
              break
            case 'identifier':
              this.index = begin === -1 ? this.index : begin
              this.parseMethodDecl(enm)
              begin = -1
              break
            case 'const-keyword':
              this.index = begin === -1 ? this.index : begin
              this.parseField(enm)
              begin = -1
              break
            case 'left-square-brace':
              this.parseAttributes()
              break
            default:
              throw new Error(`Unexpected token ${this.current.type}`)
          }
        }
      }
    }
  }

  parseField (parent) {
    const fld = {
      type: 'field',
      parent: parent
    }

    fld.visibility = this.getVisibility()
    fld.isStatic = this.accept('static-keyword')
    if (!fld.isStatic) {
      fld.isClass = this.accept('class-keyword')
    }
    if (this.accept('const-keyword')) {
      fld.type = 'constant'
    }
    fld.isUnowned = this.accept('unowned-keyword')
    if (!fld.isUnowned) {
      fld.isOwned = this.accept('owned-keyword')
    }
    fld.isWeak = this.accept('weak-keyword')
    fld.valueType = this.getType()
    fld.name = this.getIdentifier()

    if ((fld.valueType.type === 'pointer' || fld.valueType.type === 'array') && this.accept('left-square-brace')) {
      if (this.current.type === 'integer-literal') {
        fld.name += `[${this.current.lexeme}]`
        this.next()
      } else {
        fld.name += `[${this.getIdentifier()}]`
      }

      this.expect('right-square-brace')
    }

    fld.qualifiedName = this.qualifiedName(parent, fld.name)

    if (this.accept('equal')) {
      while (this.current.type !== 'semi-colon') {
        this.next()
      }
    }

    this.expect('semi-colon')

    parent.children.push(fld)
  }

  parsePropertyDecl (parent, doc) {
    const prop = {
      type: 'property',
      parent: parent
    }
    prop.documentation = doc
    prop.visibility = this.getVisibility()
    prop.isStatic = this.accept('static-keyword')
    prop.isAbstract = this.accept('abstract-keyword')
    if (!prop.isAbstract && (parent.type === 'class' || parent.type === 'interface')) {
      prop.isVirtual = this.accept('virtual-keyword')
    }
    prop.isOverride = this.accept('override-keyword')
    prop.isWeak = this.accept('weak-keyword')
    prop.isUnowned = this.accept('unowned-keyword')
    if (!prop.isUnowned) {
      prop.isOwned = this.accept('owned-keyword')
    }
    prop.valueType = this.getType()
    prop.name = this.getIdentifier()
    prop.qualifiedName = this.qualifiedName(parent, prop.name)
    this.expect('left-brace')
    this.parseProperty(prop)
    this.expect('right-brace')
    parent.children.push(prop)
  }

  parseProperty (prop) {
    let accessVis
    let isOwned = false
    while (this.current.type !== 'right-brace') {
      switch (this.current.type) {
        case 'left-square-brace':
          this.parseAttributes()
          break
        case 'get-keyword':
          prop.getter = {
            visibility: accessVis || prop.visibility,
            isOwned: isOwned,
            attributes: this.attributes
          }
          accessVis = null
          isOwned = false

          this.next()
          if (!this.accept('semi-colon')) {
            this.expect('left-brace')
            let level = 1
            while (true) {
              if (level === 0) {
                break
              }
              if (this.current.type === 'left-brace') level++
              if (this.current.type === 'right-brace') level--
              this.next()
            }
          }
          break
        case 'set-keyword':
          prop.setter = {
            visibility: accessVis || prop.visibility,
            attributes: this.attributes
          }
          accessVis = null

          this.next()
          prop.isConstruct = this.accept('construct-keyword')

          if (!this.accept('semi-colon')) {
            this.expect('left-brace')
            let level = 1
            while (true) {
              if (level === 0) {
                break
              }
              if (this.current.type === 'left-brace') level++
              if (this.current.type === 'right-brace') level--
              this.next()
            }
          }
          break
        case 'default-keyword':
          if (accessVis) {
            this.error('Default property values can\'t have visibility modifier')
            accessVis = null
          }

          if (isOwned) {
            this.error('Default property values can\'t be declared as owned')
            isOwned = false
          }

          this.next()
          this.expect('equal')
          prop.default = this.parseAssignExpression()
          this.expect('semi-colon', 'a semicolon')
          break
        case 'construct-keyword':
          prop.construct = {}
          this.next()
          if (!this.accept('semi-colon')) {
            this.expect('left-brace')
            let level = 1
            while (true) {
              if (level === 0) {
                break
              }
              if (this.current.type === 'left-brace') level++
              if (this.current.type === 'right-brace') level--
              this.next()
            }
          }
          break
        case 'private-keyword':
          accessVis = 'private'
          this.next()
          break
        case 'public-keyword':
          accessVis = 'public'
          this.next()
          break
        case 'internal-keyword':
          accessVis = 'internal'
          this.next()
          break
        case 'protected-keyword':
          accessVis = 'protected'
          this.next()
          break
        case 'owned-keyword':
          isOwned = true
          this.next()
          break
        default:
          throw new Error(`Unexpected token ${this.current.type}`)
      }
    }
  }

  parseMethodDecl (parent, doc) {
    const begin = this.index
    const meth = {
      type: 'method',
      parent: parent
    }
    meth.documentation = doc
    this.parseAttributes()
    meth.attributes = this.attributes
    meth.visibility = this.getVisibility()
    meth.isStatic = this.accept('static-keyword') || parent.type === 'namespace'
    if (!meth.isStatic) {
      meth.isClass = this.accept('class-keyword')
    }
    meth.isAbstract = this.accept('abstract-keyword')
    if (!meth.isAbstract && (parent.type === 'class' || parent.type === 'interface')) {
      meth.isVirtual = this.accept('virtual-keyword')
    }
    meth.isOverride = this.accept('override-keyword')
    if (!meth.isOverride) {
      meth.isNew = this.accept('new-keyword')
    }

    meth.isAsync = this.accept('async-keyword')

    meth.isUnowned = this.accept('unowned-keyword')
    if (!meth.isUnowned) {
      meth.isOwned = this.accept('owned-keyword')
    }

    meth.returnType = this.getType()
    try {
      meth.name = this.getIdentifier()
    } catch (err) { // Can't find any name, it could be a constructor
      if (meth.returnType.raw.split('.')[0] === parent.name) {
        this.index = begin
        this.parseConstructorDecl(parent)
        return
      } else {
        this.error(`Expected a name for this method. If you want to create a constructor, you should name it as your class (${parent.name}, not ${meth.returnType.split('.')[0]}).`)
      }
    }
    meth.qualifiedName = this.qualifiedName(parent, meth.name)
    meth.generics = this.getGenerics()

    this.expect('left-parenthese')
    meth.parameters = []
    let firstParam = true
    while (!this.accept('right-parenthese')) {
      if (firstParam) {
        firstParam = false
      } else {
        this.expect('comma')
      }

      const param = {}
      if (this.accept('ellipsis')) {
        param.isVaList = true
      } else {
        this.parseAttributes()
        param.attributes = this.attributes

        param.isVaList = this.accept('params-keyword')

        if (this.accept('out-keyword')) {
          param.out = true
        } else if (this.accept('ref-keyword')) {
          param.ref = true
        }
        param.isUnowned = this.accept('unowned-keyword')
        if (!param.isUnowned) {
          param.isOwned = this.accept('owned-keyword')
        }
        param.valueType = this.getType()
        param.name = this.getIdentifier()

        if (this.accept('equal')) {
          param.hasDefault = true
          // TODO: stop skipping it
          let level = 0
          while (!((this.current.type === 'comma' || this.current.type === 'right-parenthese') && level === 0)) {
            if (this.current.type === 'left-parenthese' || this.current.type === 'less') {
              level++
            }
            if (this.current.type === 'right-parenthese' || this.current.type === 'more') {
              level--
            }
            this.next()
          }
        }
      }

      meth.parameters.push(param)
    }

    if (this.accept('throws-keyword')) {
      meth.throws = []
      while (true) {
        meth.throws.push(this.getIdentifier())
        if (!this.accept('comma')) {
          break
        }
      }
    }
    if (this.accept('requires-keyword')) {
      while (true) {
        this.expect('left-parenthese')
        while (!this.accept('right-parenthese')) {
          this.next()
        }
        if (!this.accept('comma')) {
          break
        }
      }
    }

    if ((this.isVapi || meth.isAbstract) && this.accept('semi-colon')) {
      meth.hasBody = false
    } else {
      meth.hasBody = true
      this.expect('left-brace')
      this.parseMethod(meth)
      this.expect('right-brace')
    }

    parent.children.push(meth)
  }

  parseConstructorDecl (parent) {
    const ctor = {
      type: 'constructor',
      parent: parent
    }
    this.parseAttributes()
    ctor.attributes = this.attributes
    ctor.visibility = this.getVisibility()

    ctor.isStatic = this.accept('static-keyword')
    ctor.isAbstract = this.accept('abstract-keyword')
    if (!ctor.isAbstract && (parent.type === 'class' || parent.type === 'interface')) {
      ctor.isVirtual = this.accept('virtual-keyword')
    }
    ctor.isOverride = this.accept('override-keyword')
    if (!ctor.isOverride) {
      ctor.isNew = this.accept('new-keyword')
    }

    ctor.isAsync = this.accept('async-keyword')

    ctor.name = this.getIdentifier()
    ctor.qualifiedName = this.qualifiedName(parent, ctor.name)
    ctor.generics = this.getGenerics()

    this.expect('left-parenthese')
    ctor.parameters = []
    let firstParam = true
    while (!this.accept('right-parenthese')) {
      if (firstParam) {
        firstParam = false
      } else {
        this.expect('comma')
      }

      const param = {}
      if (this.accept('ellipsis')) {
        param.isVaList = true
      } else {
        this.parseAttributes()
        param.attributes = this.attributes

        param.isVaList = this.accept('params-keyword')

        if (this.accept('out-keyword')) {
          param.out = true
        } else if (this.accept('ref-keyword')) {
          param.ref = true
        }
        param.isUnowned = this.accept('unowned-keyword')
        if (!param.isUnowned) {
          param.isOwned = this.accept('owned-keyword')
        }
        param.valueType = this.getType()
        param.name = this.getIdentifier()

        if (this.accept('equal')) {
          // TODO: stop skipping it
          let level = 0
          while (!(this.current.type === 'comma' || (this.current.type === 'right-parenthese' && level === 0))) {
            if (this.current.type === 'left-parenthese' || this.current.type === 'less') {
              level++
            }
            if (this.current.type === 'right-parenthese' || this.current.type === 'more') {
              level--
            }
            this.next()
          }
        }
      }

      ctor.parameters.push(param)
    }

    if (this.accept('throws-keyword')) {
      ctor.throws = []
      while (true) {
        ctor.throws.push(this.getIdentifier())
        if (!this.accept('comma')) {
          break
        }
      }
    }

    if ((this.isVapi || ctor.isAbstract) && this.accept('semi-colon')) {
      ctor.hasBody = false
    } else {
      ctor.hasBody = true
      this.expect('left-brace')
      this.parseMethod(ctor)
      this.expect('right-brace')
    }

    parent.children.push(ctor)
  }

  parseMethod (meth) {
    // TODO: real parsing
    let level = 1
    while (level !== 0) {
      this.next()
      if (this.current.type === 'left-brace') {
        level++
      }
      if (this.current.type === 'right-brace') {
        level--
      }
    }
  }

  parseAssignExpression () { // TODO
    do {
      this.next()
    } while (this.current.type !== 'semi-colon')
  }

  preprocess (tokens) { // TODO: real preprocessing
    let res = []
    let take = true
    for (let i = 0; i < tokens.length; i++) {
      let token = tokens[i]

      if (token.type === 'hash') {
        token = tokens[++i]
        const line = token.line
        switch (token.type) {
          case 'if-keyword': // Presently, we always consider it as true
            while (token.line === line) {
              token = tokens[++i]
            }
            take = true
            break
          case 'else-keyword':
            while (token.line === line) {
              token = tokens[++i]
            }
            take = false
            break
          case 'elif-keyword':
            while (token.line === line) {
              token = tokens[++i]
            }
            take = false
            break
          case 'endif-keyword':
            token = tokens[++i]
            take = true
            break
          default:
            throw new Error(`Unexpected token ${token.type}`)
        }
      }

      if (take) {
        res.push(token)
      }
    }

    return res
  }

  getVisibility () {
    let vis = 'private'
    if (this.accept('public-keyword')) {
      vis = 'public'
    } else if (this.accept('internal-keyword')) {
      vis = 'internal'
    } else if (this.accept('protected-keyword')) {
      vis = 'protected'
    } else if (this.accept('private-keyword')) {
      // could seem useless, but it consumes the `private` keyword if it exists
      vis = 'private'
    }
    return vis
  }

  /**
  * Gets a qualified identifier
  */
  getIdentifier () {
    let res = ''
    let matched = false

    if (this.accept('global-keyword')) {
      if (this.accept('colon')) {
        this.expect('colon')
      } else {
        res = 'global'
        matched = true
      }
    }

    if (!matched && this.accept('at')) {
      res += '@'
      if (this.current.type.endsWith('-keyword')) {
        res += this.current.lexeme
        this.next()
        matched = true
      } else if (this.current.type === 'integer-literal') {
        res += this.current.lexeme
        this.next()
        try {
          const rest = this.getIdentifier()
          if (rest.startsWith('@')) {
            throw new Error('Unexpected @')
          } else {
            res += rest
            matched = true
          }
        } catch (err) { // The identifier is just a number
          matched = true
        }
      } else if (this.current.type === 'identifier') {
        this.warn('Useless @. Only use it with reserved keywords.')
      } else {
        throw new Error(`Unexpected ${this.current.type}`)
      }
    }

    if (!matched) {
      if (this.current.type === 'identifier') {
        res += this.current.lexeme
        this.next()
        matched = true
      } else if (this.current.type.endsWith('-keyword')) {
        this.warn('Prefix it with a @ to avoid confusion with the keyword.')
        res += this.current.lexeme
        this.next()
        matched = true
      } else if (this.current.type === 'integer-literal') {
        this.warn('Prefix it with a @ to avoid confusion with an integer literal.')
        res += this.current.lexeme
        this.next()
        try {
          const rest = this.getIdentifier()
          if (rest.startsWith('@')) {
            throw new Error('Unexpected @')
          } else {
            res += rest
            matched = true
          }
        } catch (err) { // The identifier is just a number
          matched = true
        }
      } else {
        throw new Error(`Unexpected ${this.current.type} (${this.current.lexeme})`)
      }
    }

    if (matched && this.accept('dot')) {
      res += '.'
      const nextPart = this.getIdentifier()
      if (nextPart) {
        res += nextPart
      } else {
        throw new Error('Expected an identifier after the .')
      }
    } else if (!matched) {
      throw new Error('Expected an identifier')
    }

    if (this.accept('left-square-brace')) {
      res += '['
      if (this.accept('right-square-brace')) {
        res += ']'
      } else {
        if (this.accept('integer-literal')) {
          res += this.previous.lexeme
        } else {
          res += this.getIdentifier()
        }
        this.expect('right-square-brace')
        res += ']'
      }
    }

    return res
  }

  /**
  * Gets the name of type
  */
  getType () {
    const isUnowned = this.accept('unowned-keyword')
    const isOwned = this.accept('owned-keyword')
    let res = {}
    let raw = ''
    if (this.accept('left-parenthese')) {
      raw += '('
      res.type = this.getType()
      raw += res.type.raw
      this.expect('right-parenthese')
      raw += ')'
    } else {
      res.type = this.getIdentifier()
      raw += res.type
    }
    while (this.accept('multiply')) { // * for pointers
      res = {
        type: 'pointer',
        of: res
      }
      raw += '*'
    }

    const gens = this.getGenerics()
    if (gens.length > 0) {
      res.generics = gens
      raw += `<${gens.map(g => { return g.raw }).join(', ')}>`
    }
    if (this.accept('question-mark')) {
      res.nullable = true
      raw += '?'
    }

    if (this.accept('left-square-brace') && this.accept('right-square-brace')) {
      res = {
        type: 'array',
        of: res
      }
      raw += '[]'
      if (this.accept('question-mark')) {
        res.nullable = true
        raw += '?'
      }
    }
    res.isUnowned = isUnowned
    res.isOwned = isOwned
    res.raw = raw
    return res
  }

  getGenerics () {
    let res = []
    if (this.accept('less')) {
      do {
        this.accept('weak-keyword')
        const gen = this.getType()
        if (gen) {
          res.push(gen)
        } else {
          throw new Error('Expected identifier')
        }
      } while (this.accept('comma'))
      this.expect('more')
    }
    return res
  }

  parseAttributes () {
    this.attributes = []
    if (!this.accept('left-square-brace')) {
      return
    }
    while (true) {
      const attr = {}

      attr.name = this.current.lexeme
      this.expect('identifier')

      if (this.accept('left-parenthese')) {
        let first = true
        attr.parameters = []
        while (!this.accept('right-parenthese')) {
          if (first) {
            first = false
          } else {
            this.expect('comma')
          }

          const param = {
            name: this.getIdentifier()
          }

          this.expect('equal')

          switch (this.current.type) {
            case 'double-quote':
              param.type = 'string'
              param.value = this.getStringLiteral()
              break
            case 'false-keyword':
              param.type = 'bool'
              param.value = false
              this.next()
              break
            case 'true-keyword':
              param.type = 'bool'
              param.value = false
              this.next()
              break
            case 'integer-literal':
              param.type = 'int'
              param.value = Number.parseInt(this.current.lexeme)
              this.next()
              break
            case 'double-literal':
              param.type = 'double'
              param.value = Number.parseFloat(this.current.lexeme)
              this.next()
              break
            default:
              throw new Error(`Attribute parameters can only be strings, boolean or numbers (got ${this.current.type})`)
          }

          attr.parameters.push(param)
        }
      }

      if (this.accept('right-square-brace')) {
        this._attributes.push(attr)
        if (!this.accept('left-square-brace')) {
          break
        }
      } else if (this.accept('comma')) { // You can have things like that [Attr (foo = 42), Bar, Baz], see string.printf
        this._attributes.push(attr)
      }
    }
  }

  getStringLiteral () {
    let res = ''
    const quoteStyle = this.current.type
    if (quoteStyle !== 'double-quote' && quoteStyle !== 'triple-double-quote') {
      throw new Error('Expected the beginning of a string')
    }

    this.next()

    while (!this.accept(quoteStyle)) {
      res += this.current.lexeme
      this.next()
    }

    return res
  }
}
