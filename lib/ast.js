'use babel'

export class AST {
  constructor (ast) {
    this.tree = ast

    this.tree.children[0].root = true
    this.root = this.tree.children[0]

    this.explore((symb, parent) => {
      if (parent && parent !== this.tree) {
        symb.parent = parent
      }

      symb.getFile = () => symb.location && symb.location.file
        ? symb.location.file
        : ''
    })
  }

  explore (cb, symbol = this.tree) {
    AST.explore(symbol, cb)
  }

  static explore (symbol, cb) {
    for (const child of symbol.children) {
      if (cb(child, symbol) !== false && child.children) {
        AST.explore(cb, child)
      }
    }
  }
}
