'use babel'

import { CompositeDisposable } from 'atom'
import { spawnSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import etch from 'etch'

import GeneratorView from './views/generator/generator'
import ValaProvider from './vala-provider'
import DocProvider from './doc-provider'
import Generator from './generator'
import DocViewer from './views/doc/doc'
import ValacBuilder from './builder'
import ValaLexer from './lexer'
import ValaParser from './parser'
import Report from './report'
import StyleChecker from './style-checker'

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
  atom.workspace.addOpener(uri => {
    if (uri.startsWith(docProtocol)) {
      let dv = new DocViewer()
      return dv
    }
  })

  // registers commands
  subscriptions.add(atom.commands.add('atom-workspace', {
    'valhalla:new-class': () => newClass(),
    'valhalla:new-interface': () => newIface(),
    'valhalla:documentation': () => atom.workspace.open(docProtocol + '/'),
    'valhalla:clear-errors': () => report.clear(),
    'valhalla:debug': () => {
      console.log({
        files: files,
        report: report,
        linter: linter
      })
    }
  }))

  subscriptions.add(atom.commands.add('atom-text-editor', {
    'valhalla:surround': () => surround()
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
        (async () => {
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
        })()
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
    busy.begin(taskId, `Parsing ${shortPath}`)

    busy.end(taskId, parser.parse())
    return parser.file
  }
  throw new Error('Unable to tokenize file.')
}

export function deactivate () {
  subscriptions.dispose()
}

export function newClass () {
  GeneratorView.show('class')
}

export function newIface () {
  GeneratorView.show('interface')
}

export function surround () {
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
    callback: 'valhalla:documentation',
    tooltip: 'Open Vala documentation'
  })
  toolbar.addButton({
    icon: 'plus',
    callback: 'valhalla:new-class',
    tooltip: 'Create a new Vala class'
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
