'use babel'

import grammar from './vala-grammar'
import {report} from './valhalla'

export default class ValaLexer {

  /**
  *  Creates a new Lexer for a code file
  *
  * @param code Content of the file.
  * @param path The path of the file.
  */
  constructor (code, path) {
    this.code = code
    this.line = 0
    this.col = 0
    this.path = path
  }

  get line () {
    return this._line
  }

  set line (val) {
    this.col = 0
    this._line = val
  }

  /**
  *  Runs the lexer
  *
  *  @return Array<Token>
  */
  tokenize () {
    this.tokens = []
    let stack = ['code']
    let source = this.code.replace('\r\n', '\n')

    while (source.length > 0) {
      let match = false

      try {
        for (const rule of grammar.rules[stack[stack.length - 1]]) {
          let evaluated = this.eval(source, rule)
          if (evaluated) {
            if (evaluated.token) {
              const res = evaluated.token
              res.line = this.line
              res.column = this.col
              this.tokens.push(res)
            }

            if (rule.pop) {
              stack.pop()
            }

            if (rule.push) {
              for (const scope of rule.push) {
                stack.push(scope)
              }
            }

            if (evaluated.size > source.indexOf('\n')) {
              this.line++
              this.col = evaluated.size - source.indexOf('\n')
            } else {
              this.col += evaluated.size
            }

            match = true
            source = source.substring(evaluated.size)
            break
          }
        }
      } catch (ex) {
        report.error(`[Lexer] ${ex.message} ${stack}`, this.line, this.col, this.path)
        return false
      }

      if (!match) {
        report.error(`(${stack}) Unexpected character "${source[0]}"`, this.line, this.col, this.path)
        return false
      }
    }

    return true
  }

  /**
  *  Runs an evaluator
  *
  *  @return { size: Number, token: Token }
  */
  eval (source, evaluator) {
    const match = source.match(evaluator.regex)
    if (match) {
      return {
        size: match[0].length,
        token: evaluator.eval ? evaluator.eval(match[0]) : null
      }
    }
    return null
  }
}
