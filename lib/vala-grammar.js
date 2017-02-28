'use babel'

export class ValaGrammar {
  constructor () {
    this.rules = {}
    this.rules['code'] = this.codeRules()
    this.rules['single-line-comment'] = this.singleLineCommRules()
    this.rules['multiline-comment'] = this.multilineCommentRules()
    this.rules['multiline-string-literal'] = this.multilineStringLiteralRules()
    this.rules['string-literal'] = this.stringLiteralRules()
    this.rules['char-literal'] = this.charLiteralRules()
    this.rules['regex-literal'] = this.regexLitteralRules()
    this.rules['preprocessor'] = this.preprocessorRules()
  }

  /**
  *  Creates an eval function for a token without lexeme
  */
  token (type) {
    return (lxm) => {
      return {
        type: type,
        lexeme: lxm
      }
    }
  }

  codeRules () {
    return [

      // Ignore spaces

      {
        regex: /\s/
      },

      // Comments

      {
        regex: /\/\//,
        push: ['single-line-comment']
      },
      {
        regex: /\/\*/,
        push: ['multiline-comment'],
        eval: this.token('multiline-comment-begin')
      },

      // Punctuations

      {
        regex: /;/,
        eval: this.token('semi-colon')
      },
      {
        regex: /,/,
        eval: this.token('comma')
      },
      {
        regex: /:/,
        eval: this.token('colon')
      },
      {
        regex: /\.\.\./,
        eval: this.token('ellipsis')
      },
      {
        regex: /\./,
        eval: this.token('dot')
      },
      {
        regex: /\?/,
        eval: this.token('question-mark')
      },
      {
        regex: /{/,
        eval: this.token('left-brace')
      },
      {
        regex: /}/,
        eval: this.token('right-brace')
      },
      {
        regex: /\(/,
        eval: this.token('left-parenthese')
      },
      {
        regex: /\)/,
        eval: this.token('right-parenthese')
      },
      {
        regex: /\[/,
        eval: this.token('left-square-brace')
      },
      {
        regex: /\]/,
        eval: this.token('right-square-brace')
      },

      // Litterals

      {
        regex: /@/,
        eval: this.token('at')
      },
      {
        regex: /"""/,
        eval: this.token('triple-double-quote'),
        push: ['multiline-string-literal']
      },
      {
        regex: /"/,
        eval: this.token('double-quote'),
        push: ['string-literal']
      },
      {
        regex: /'/,
        eval: this.token('single-quote'),
        push: ['char-literal']
      },
      {
        regex: /\//,
        eval: this.token('slash'),
        push: ['regex-literal']
      },
      {
        regex: /-?\d+\.\d+/,
        eval: this.token('double-literal')
      },
      {
        regex: /-?\d+/,
        eval: this.token('integer-literal')
      },
      {
        regex: /true\b/,
        eval: this.token('true-keyword')
      },
      {
        regex: /false\b/,
        eval: this.token('false-keyword')
      },

      // Operators

      {
        regex: /#/,
        eval: this.token('hash'),
        push: ['preprocessor']
      },
      {
        regex: /=>/,
        eval: this.token('arrow')
      },
      {
        regex: /<=/,
        eval: this.token('less-or-equal')
      },
      {
        regex: />=/,
        eval: this.token('more-or-equal')
      },
      {
        regex: /==/,
        eval: this.token('double-equal')
      },
      {
        regex: /&&/,
        eval: this.token('boolean-and')
      },
      {
        regex: /\|\|/,
        eval: this.token('boolean-or')
      },
      {
        regex: /!/,
        eval: this.token('boolean-not')
      },
      {
        regex: />/,
        eval: this.token('more')
      },
      {
        regex: /</,
        eval: this.token('less')
      },
      {
        regex: /=/,
        eval: this.token('equal')
      },
      {
        regex: /&/,
        eval: this.token('bit-and')
      },
      {
        regex: /\|/,
        eval: this.token('bit-or')
      },
      {
        regex: /\+=/,
        eval: this.token('plus-equal')
      },
      {
        regex: /-=/,
        eval: this.token('less-equal')
      },
      {
        regex: /\*=/,
        eval: this.token('multiply-equal')
      },
      {
        regex: /\/=/,
        eval: this.token('division-equal')
      },
      {
        regex: /%=/,
        eval: this.token('modulo-equal')
      },
      {
        regex: /\+/,
        eval: this.token('plus')
      },
      {
        regex: /-/,
        eval: this.token('less')
      },
      {
        regex: /\*/,
        eval: this.token('multiply')
      },
      {
        regex: /\//,
        eval: this.token('division')
      },
      {
        regex: /%/,
        eval: this.token('modulo')
      },

      // Keywords

      {
        regex: /using\b/,
        eval: this.token('using-keyword')
      },
      {
        regex: /namespace\b/,
        eval: this.token('namespace-keyword')
      },
      {
        regex: /class\b/,
        eval: this.token('class-keyword')
      },
      {
        regex: /interface\b/,
        eval: this.token('interface-keyword')
      },
      {
        regex: /struct\b/,
        eval: this.token('struct-keyword')
      },
      {
        regex: /enum\b/,
        eval: this.token('enum-keyword')
      },
      {
        regex: /errordomain\b/,
        eval: this.token('errordomain-keyword')
      },
      {
        regex: /public\b/,
        eval: this.token('public-keyword')
      },
      {
        regex: /private\b/,
        eval: this.token('private-keyword')
      },
      {
        regex: /internal\b/,
        eval: this.token('internal-keyword')
      },
      {
        regex: /protected\b/,
        eval: this.token('protected-keyword')
      },
      {
        regex: /get\b/,
        eval: this.token('get-keyword')
      },
      {
        regex: /set\b/,
        eval: this.token('set-keyword')
      },
      {
        regex: /construct\b/,
        eval: this.token('construct-keyword')
      },
      {
        regex: /default\b/,
        eval: this.token('default-keyword')
      },
      {
        regex: /out\b/,
        eval: this.token('out-keyword')
      },
      {
        regex: /ref\b/,
        eval: this.token('ref-keyword')
      },
      {
        regex: /static\b/,
        eval: this.token('static-keyword')
      },
      {
        regex: /abstract\b/,
        eval: this.token('abstract-keyword')
      },
      {
        regex: /virtual\b/,
        eval: this.token('virtual-keyword')
      },
      {
        regex: /override\b/,
        eval: this.token('override-keyword')
      },
      {
        regex: /owned\b/,
        eval: this.token('owned-keyword')
      },
      {
        regex: /unowned\b/,
        eval: this.token('unowned-keyword')
      },
      {
        regex: /weak\b/,
        eval: this.token('weak-keyword')
      },
      {
        regex: /throws\b/,
        eval: this.token('throws-keyword')
      },
      {
        regex: /throw\b/,
        eval: this.token('throw-keyword')
      },
      {
        regex: /try\b/,
        eval: this.token('try-keyword')
      },
      {
        regex: /catch\b/,
        eval: this.token('catch-keyword')
      },
      {
        regex: /signal\b/,
        eval: this.token('signal-keyword')
      },
      {
        regex: /delegate\b/,
        eval: this.token('delegate-keyword')
      },
      {
        regex: /async\b/,
        eval: this.token('async-keyword')
      },
      {
        regex: /global\b/,
        eval: this.token('global-keyword')
      },
      {
        regex: /new\b/,
        eval: this.token('new-keyword')
      },
      {
        regex: /delete\b/,
        eval: this.token('delete-keyword')
      },
      {
        regex: /var\b/,
        eval: this.token('var-keyword')
      },
      {
        regex: /base\b/,
        eval: this.token('base-keyword')
      },
      {
        regex: /as\b/,
        eval: this.token('as-keyword')
      },
      {
        regex: /foreach\b/,
        eval: this.token('foreach-keyword')
      },
      {
        regex: /in\b/,
        eval: this.token('in-keyword')
      },
      {
        regex: /for\b/,
        eval: this.token('for-keyword')
      },
      {
        regex: /params\b/,
        eval: this.token('params-keyword')
      },
      {
        regex: /requires\b/,
        eval: this.token('requires-keyword')
      },
      {
        regex: /ensure\b/,
        eval: this.token('ensure-keyword')
      },
      {
        regex: /const\b/,
        eval: this.token('const-keyword')
      },

      // Identifiers

      {
        regex: /[a-zA-Z_]\w*/,
        eval: this.token('identifier')
      }
    ]
  }

  singleLineCommRules () {
    return [
      {
        regex: /\n/,
        pop: true
      },
      {
        regex: /.+/,
        eval: this.token('single-line-comment', true)
      }
    ]
  }

  multilineCommentRules () {
    return [
      {
        regex: /\*\//,
        pop: true,
        eval: this.token('multiline-comment-end')
      },
      {
        regex: /\r|\n/,
        eval: this.token('line-break')
      },
      {
        regex: /./,
        eval: this.token('multiline-comment', true)
      }
    ]
  }

  multilineStringLiteralRules () {
    return [
      {
        regex: /"""/,
        pop: true,
        eval: this.token('triple-double-quote')
      },
      {
        regex: /\n/,
        eval: this.token('line-break')
      },
      {
        regex: /./,
        eval: this.token('char', true)
      }
    ]
  }

  stringLiteralRules () {
    return [
      {
        regex: /"/,
        pop: true,
        eval: this.token('double-quote')
      },
      {
        regex: /\n/,
        eval: () => {
          throw new Error('Use """ for multiline string literals.')
        }
      },
      {
        regex: /\\?./,
        eval: this.token('char', true)
      }
    ]
  }

  charLiteralRules () {
    return [
      {
        regex: /'/,
        pop: true,
        eval: this.token('single-quote')
      },
      {
        regex: /\\?./,
        eval: this.token('char', true)
      }
    ]
  }

  regexLitteralRules () {
    return [
      {
        regex: /\\\//,
        eval: this.token('char', true)
      },
      {
        regex: /\//,
        pop: true,
        eval: this.token('slash')
      },
      {
        regex: /./,
        eval: this.token('char', true)
      }
    ]
  }

  preprocessorRules () {
    return [
      {
        regex: /\n/,
        pop: true,
        eval: this.token('line-break')
      },
      {
        regex: /\s+/
      },

      {
        regex: /\|\|/,
        eval: this.token('boolean-or')
      },
      {
        regex: /&&/,
        eval: this.token('boolean-and')
      },
      {
        regex: /!/,
        eval: this.token('boolean-not')
      },
      {
        regex: /==/,
        eval: this.token('double-equal')
      },
      {
        regex: /!=/,
        eval: this.token('not-equal')
      },

      {
        regex: /if\b/,
        eval: this.token('if-keyword')
      },
      {
        regex: /elif\b/,
        eval: this.token('elif-keyword')
      },
      {
        regex: /else\b/,
        eval: this.token('else-keyword')
      },
      {
        regex: /endif\b/,
        eval: this.token('endif-keyword')
      },

      {
        regex: /true\b/,
        eval: this.token('true-keyword')
      },
      {
        regex: /false\b/,
        eval: this.token('false-keyword')
      },

      {
        regex: /\w+/,
        eval: this.token('identifier')
      }
    ]
  }
}

/**
* Changes the regexs to match only the beginning of the string.
*
* We don't do it directly to keep them clear.
*/
function getGrammar () {
  const grammar = new ValaGrammar()
  for (var rule in grammar.rules) {
    if (grammar.rules.hasOwnProperty(rule) && grammar.rules[rule] instanceof Array) {
      for (const evaluator of grammar.rules[rule]) {
        evaluator.regex = new RegExp('^' + evaluator.regex.source, evaluator.regex.flags)
      }
    }
  }
  return grammar
}

export default getGrammar()
