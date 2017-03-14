'use babel'

import { CompositeDisposable } from 'atom'
import { spawnSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import etch from 'etch'

import InputView from './views/modals/input'
import SymbolsView from './views/symbols/symbols'
import ValaProvider from './vala-provider'
import DocProvider from './doc-provider'
import Generator from './generator'
import DocViewer from './views/doc/doc'
import ValacBuilder from './builder'
import ValaLexer from './lexer'
import ValaParser from './parser'
import Report from './report'
import StyleChecker from './style-checker'
import * as contextMenu from './context-menu'

const docProtocol = 'valadoc://'

DocViewer.name = 'DocViewer'
atom.deserializers.add(DocViewer)

export const report = new Report()
export const generator = new Generator()
const style = new StyleChecker()
const subscriptions = new CompositeDisposable()

let linter = null
let busy = null

export function getVapiDir () {
  // TODO: make it change with the installed Vala version
  if (process.platform === 'linux') {
    return '/usr/share/vala/vapi/:/usr/share/vala-0.34/vapi/'
  } else if (process.platform === 'win32') {
    return 'C:\\ProgramData\\vala-0.20\\vapi\\'
  } else {
    return '/usr/local/Cellar/vala/0.34.4/share/vala-0.34/vapi/'
  }
}

export const config = {
  vapiDir: {
    type: 'string',
    default: getVapiDir(),
    title: 'Vapi files directory. You can use ' + path.delimiter + ' as a separator if you have many directories.'
  },
  valacArgs: {
    type: 'string',
    title: 'Valac custom arguments',
    description: 'To use with the atom-build package. If not specified, it will just build all the files of your project.',
    default: ''
  },
  glibVersion: {
    type: 'string',
    default: (() => {
      let pkgConf = spawnSync('pkg-config', ['--modversion', 'glib-2.0'], { encoding: 'utf-8' })
      if (!pkgConf.error) {
        return pkgConf.stdout.toString().replace('\n', '')
      } else {
        console.warn('error while spawning pkg-config', pkgConf.error.message)
        return '2.50.2'
      }
    })(),
    title: 'The GLib version you are using'
  },
  warnVapi: {
    type: 'boolean',
    default: false,
    title: 'Warning in vapi files',
    description: 'Because some vapi files are quite old, they could contain many warnings nowadays. To avoid all these anoying reports, just disable this checkbox.'
  }
}

export let files = []

export function activate (state) {
  etch.setScheduler(atom.views)

  // documentation
  let docItem = null // Allow us to open a specific doc item at a certain time (set this variable and then open doc)
  atom.workspace.addOpener(uri => {
    if (uri.startsWith(docProtocol)) {
      let dv = new DocViewer({ item: docItem })
      dv.onDestroy = () => { docItem = null }
      return dv
    }
  })

  // registers commands
  subscriptions.add(atom.commands.add('atom-workspace', {
    'valhalla:new-class': () => newClass(),
    'valhalla:new-interface': () => newIface(),
    'valhalla:documentation': () => atom.workspace.open(docProtocol + '/'),
    'valhalla:clear-errors': () => report.clear(),
    'valhalla:toggle-symbols-list': () => toggleSymbolsList(),
    'valhalla:debug': () => {
      console.log({
        files: files,
        report: report,
        linter: linter
      })
    }
  }))

  subscriptions.add(atom.commands.add('atom-text-editor', {
    'valhalla:create-child-class': () => childClass(),
    'valhalla:surround': () => surround()
  }))

  subscriptions.add(atom.commands.add('.vala-symbols', {
    'valhalla:show-in-documentation': (event) => {
      let elt = event.target
      do {
        if (elt.item) {
          docItem = elt.item
          atom.workspace.open(docProtocol + '/')
          break
        }
        elt = elt.parentElement
      } while (elt.tagName !== 'DIV')
    }
  }))

  // parsing code
  const vapiDir = atom.config.get('valhalla.vapiDir')

  report.onNewReport(showErrors)

  const explore = (dir) => {
    fs.readdir(dir, (err, dirChildren) => {
      if (err) {
        report.error(err.message)
        return
      }

      for (const file of dirChildren) {
        const completePath = path.join(dir, file)
        fs.stat(completePath, (err, stats) => {
          if (err) {
            report.error(err.message)
            return
          }

          if (stats.isDirectory() && !file.startsWith('.')) {
            explore(completePath)
          } else if (file.endsWith('.vala') || file.endsWith('.vapi')) {
            fs.readFile(completePath, { encoding: 'utf-8' }, (err, content) => {
              if (err) {
                report.error(err.message)
                return
              }

              parse(content, completePath).then(ast => {
                files.push(ast)
              }).catch(err => {
                console.error(err)
              })
            })
          }
        })
      }
    })
  }

  for (const project of atom.project.getPaths()) {
    explore(project)
  }

  atom.workspace.observeTextEditors(ed => {
    if (ed.getPath() && (ed.getPath().endsWith('.vala') || ed.getPath().endsWith('.vapi'))) {
      contextMenu.setup(ed)

      ed.onDidStopChanging(() => {
        let index = files.findIndex(f => { return f.path === ed.getPath() })
        index = index >= 0 ? index : files.length

        report.clear(ed.getPath())

        parse(ed.getText(), ed.getPath()).then(ast => {
          files[index] = ast
        }).catch(err => {
          console.error(err)
        })

        style.check(ed.getText(), ed.getPath())
      })
    }
  })

  // loading symbols from .vapi
  for (const dir of vapiDir.split(path.delimiter)) {
    fs.readdir(dir, (err, children) => {
      if (err) {
        report.error(err)
        return
      }

      for (const file of children) {
        if (file.endsWith('.vapi')) {
          const completePath = path.join(dir, file)
          fs.readFile(completePath, 'utf-8', (err, content) => {
            if (err) {
              report.error(err.message)
            }

            parse(content, completePath).then(ast => {
              files.push(ast)
            }).catch(err => {
              console.error(err)
            })
          })
        }
      }
    })
  }
}

async function parse (content, file) {
  const lexer = new ValaLexer(content, file)

  if (lexer.tokenize()) {
    const parser = new ValaParser(lexer.tokens, file)
    const shortPath = path.basename(file)
    const taskId = `valhalla.parsing-${shortPath}`
    if (busy) {
      busy.begin(taskId, `Parsing ${shortPath}`)
    }

    const res = parser.parse()

    if (busy) {
      busy.end(taskId, res)
    }

    return parser.file
  }
  throw new Error('Unable to tokenize file.')
}

export function deactivate () {
  contextMenu.dispose()
  subscriptions.dispose()
}

let symbolPanel = null
function toggleSymbolsList () {
  if (!symbolPanel) {
    const view = new SymbolsView({
      onHide: () => symbolPanel.hide(),
      onShow: () => {
        if (symbolPanel) {
          symbolPanel.show()
        }
      }
    }, [])
    symbolPanel = atom.workspace.addRightPanel({
      visible: false,
      item: view.element
    })
  }

  symbolPanel.isVisible()
    ? symbolPanel.hide()
    : symbolPanel.show()
}

/**
* Transform a camel or snake case string into a kebab case string
*
* snake_case -> snake-case
* CamelCase -> camel-case
*/
function kebabify (str) {
  const noSnake = str.replace('_', '-')
  let res = ''
  for (const ch of noSnake) {
    if (ch.toUpperCase() === ch && res !== '') {
      res += '-'
    }
    res += ch.toLowerCase()
  }
  return res
}

function childClass () {
  const currEd = atom.workspace.getActiveTextEditor()
  const parentName = currEd.getWordUnderCursor({ wordRegex: /[\w.]+/ })
  InputView.show('Choose a name for your new class',
    (input) => generator.genClass(input, kebabify(input), [parentName]),
    'MyChildClass',
    validateTypeName('class')
  )
}

const invalidTypeName = /[^\w.<>,]/
function validateTypeName (type) {
  return (name) => {
    const res = {
      warnings: []
    }
    res.error = name.match(invalidTypeName) ? `There is an invalid character in your ${type} name.` : null
    if (name[0] && name[0].toLowerCase() === name[0]) {
      res.warnings.push('Type names shoud start with a capital letter.')
    }

    if (name.includes('_')) {
      res.warnings.push('Use UpperCamelCase for type names.')
    }

    return res
  }
}

function newClass () {
  InputView.show('Choose a name for your new class',
    (input) => generator.genClass(input, kebabify(input), ['Object']),
    'MyNewClass',
    validateTypeName('class')
  )
}

function newIface () {
  InputView.show('Choose a name for your new interface',
    (input) => generator.genIface(input, kebabify(input), ['Object']),
    'MyNewInterface',
    validateTypeName('interface')
  )
}

function surround () {
  // get selected text
  const editor = atom.workspace.getActiveTextEditor()
  const sel = editor.getSelectedBufferRange()
  const txt = editor.getTextInBufferRange(sel)
  const lines = txt.split('\n')
  const tab = editor.getTabText() // getting text used for tabs(`  `, `    `, `\t`, ...)

  const indent = {}
  const currentIndentLevel = (lines[lines.length - 1].match(tab) || []).length
  indent.surrounder = tab.repeat(currentIndentLevel)
  if (sel.start.column !== 0) { // doesn't selected the beginning of the line
    indent.firstLine = tab.repeat(currentIndentLevel + 1)
  } else {
    indent.firstLine = indent.surrounder
  }

  const newText = indent.firstLine + lines.join('\n' + tab)
  const bufferToReplace = sel
  bufferToReplace.start.column = 0
  editor.setTextInBufferRange(bufferToReplace, `${indent.surrounder} {
${newText}
${indent.surrounder}}`)
  const newSel = [sel.start.row, sel.start.column + indent.surrounder.length]
  editor.setSelectedBufferRange([newSel, newSel])
}

function showErrors () {
  if (linter) {
    linter.setMessages([])
    linter.setMessages(report.reports.map(rep => {
      const rng = [[rep.begin.line, rep.begin.column - 1], [rep.end.line, rep.end.column - 1]]
      return {
        type: capitalize(rep.type),
        text: rep.message,
        filePath: rep.file,
        range: rng
      }
    }))
  }
}

function capitalize (str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function getProvider () {
  return [ new ValaProvider(), new DocProvider() ]
}

export function getBuilder () {
  return ValacBuilder
}

export function consumeToolBar (getBar) {
  const toolbar = getBar('valhalla')
  toolbar.addSpacer()
  toolbar.addButton({
    icon: 'book',
    iconset: 'fa',
    callback: 'valhalla:documentation',
    tooltip: 'Open Vala documentation'
  })
  toolbar.addButton({
    icon: 'plus-round',
    iconset: 'ion',
    callback: 'valhalla:new-class',
    tooltip: 'New Vala class'
  })
  toolbar.addButton({
    icon: 'android-list',
    iconset: 'ion',
    callback: 'valhalla:toggle-symbols-list',
    tooltip: 'Toggle symbols list'
  })
  toolbar.addButton({
    icon: 'close-circle',
    iconset: 'ion',
    callback: 'valhalla:clear-errors',
    tooltip: 'Clear errors'
  })
}

export function consumeLinter (indieRegistry) {
  linter = indieRegistry.register({
    name: 'Valhalla'
  })
  subscriptions.add(linter)
  showErrors()
}

export function consumeBusy (registry) {
  busy = registry
}
