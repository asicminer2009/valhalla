'use babel'

import { CompositeDisposable } from 'atom'
import etch from 'etch'

import InputView from './views/modals/input'
import SymbolsView from './views/symbols/symbols'
import ValaProvider from './vala-provider'
import DocProvider from './doc-provider'
import Generator from './generator'
import DocViewer from './views/doc/doc'
import ValacBuilder from './builder'
import Report from './report'
import StyleChecker from './style-checker'
import * as contextMenu from './context-menu'
import Service from './service'

const docProtocol = 'valadoc://'

DocViewer.name = 'DocViewer'
atom.deserializers.add(DocViewer)

export const report = new Report()
export const generator = new Generator()
const style = new StyleChecker()
const subscriptions = new CompositeDisposable()

let linter = null

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
  valacArgs: {
    type: 'string',
    title: 'Valac custom arguments',
    description: 'To use with the atom-build package. If not specified, it will just build all the files of your project.',
    default: ''
  },
  packages: {
    type: 'array',
    default: [ 'glib-2.0', 'gio-2.0', 'gmodule-2.0', 'gobject-2.0', 'gee-0.8' ],
    title: 'Packages to parse'
  },
  customIcons: {
    type: 'boolean',
    default: true,
    title: 'Use icons from Valadoc',
    description: 'Use the icons from Valadoc instead of the default one in the autocompletion list'
  },
  removeDefaultSuggestions: {
    type: 'boolean',
    default: true,
    title: 'Don\'t show Atom\'s suggestions'
  }
}

export function activate (state) {
  etch.setScheduler(atom.views)

  // documentation
  let docItem = null // Allow us to open a specific doc item at a certain time (set this variable and then open doc)
  atom.workspace.addOpener(uri => {
    if (uri.startsWith(docProtocol)) {
      return new DocViewer({
        item: docItem,
        onDestroy: () => { docItem = null }
      })
    }
  })

  const symbols = new SymbolsView()

  // registers commands
  subscriptions.add(atom.commands.add('atom-workspace', {
    'valhalla:new-class': newClass,
    'valhalla:new-interface': newIface,
    'valhalla:documentation': () => atom.workspace.open(docProtocol),
    'valhalla:clear-errors': report.clear,
    'valhalla:toggle-symbols-list': () => atom.workspace.toggle(symbols),
    'valhalla:stop-servers': () => {
      for (const service of services) {
        service.stop()
      }
    },
    'valhalla:debug': () => console.log({ report, linter })
  }))

  subscriptions.add(atom.commands.add('atom-text-editor', {
    'valhalla:create-child-class': childClass,
    'valhalla:surround': surround,
    'valhalla:lint': () => {
      const ed = atom.workspace.getActiveTextEditor()
      style.check(ed.getText(), ed.getPath())
    }
  }))

  subscriptions.add(atom.commands.add('.vala-symbols', {
    'valhalla:show-in-documentation': event => {
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

  startService()
}

let services = []
function startService () {
  for (const project of atom.project.getPaths()) {
    services.push(new Service(project))
  }

  atom.project.onDidChangePaths(() => {
    const projects = atom.project.getPaths()
    const toAdd = projects.filter(p => !serviceForFile(p))
    const toRemove = services.filter(s => !projects.includes(s.project))
    for (const add in toAdd) {
      services.push(new Service(add))
    }
    for (const prj of toRemove) {
      prj.stop()
    }
  })

  atom.workspace.observeTextEditors(ed => {
    if (ed.getPath() && (ed.getPath().endsWith('.vala') || ed.getPath().endsWith('.vapi'))) {
      contextMenu.setup(ed)
      ed.onDidSave(refresh(ed))
      ed.onDidStopChanging(() => {
        const cursor = ed.getCursorBufferPosition()
        const lastChar = ed.getTextInBufferRange([[cursor.row, cursor.column - 1], cursor])
        if (lastChar === ';') {
          ed.save()
        }
      })
    }
  })
}

function refresh (ed) {
  return () => {
    const service = serviceForFile(ed.getPath())
    service.refresh().then(() => {
      return service.fetchErrors()
    }).then(errs => {
      const linterMessage = type => {
        return err => {
          const canEnlargeEmptyError =
            err.message.indexOf('\'') !== -1 && err.message.indexOf('`') !== -1 &&
            err.location.end.column === err.location.begin.column
          const endCol = canEnlargeEmptyError
            ? err.location.end.column
            : err.location.begin.column + (err.message.indexOf('\'') - err.message.indexOf('`') - 2)

          return {
            location: {
              file: err.location.file,
              position: [
                [err.location.begin.line - 1, err.location.begin.column - 1],
                [err.location.end.line - 1, endCol]
              ]
            },
            excerpt: err.message,
            severity: type
          }
        }
      }
      linter.setAllMessages(errs.errors.map(linterMessage('error')).concat(errs.warnings.map(linterMessage('warning'))))
    })
  }
}

export function serviceForFile (file) {
  for (const serv of services) {
    if (file.startsWith(serv.project)) {
      return serv
    }
  }
}

export async function serviceForFileOrDefault (file) {
  const service = serviceForFile(file)
  if (!service) {
    for (const serv of services) {
      if ((await serv.getAst()).lenght > 0) {
        return serv
      }
    }
    return services[0]
  } else {
    return service
  }
}

export function deactivate () {
  contextMenu.dispose()
  subscriptions.dispose()
  for (const service of services) {
    service.stop()
  }
}

function childClass () {
  const currEd = atom.workspace.getActiveTextEditor()
  const parentName = currEd.getWordUnderCursor({ wordRegex: /[\w.]+/ })
  InputView.show('Choose a name for your new class',
    (input) => generator.genClass(input, input, [parentName]),
    'MyChildClass',
    validateTypeName('class')
  )
}

const invalidTypeName = /[^\w.<>,]/
function validateTypeName (type) {
  return name => {
    const res = {
      error: name.match(invalidTypeName) ? `There is an invalid character in your ${type} name.` : null,
      warnings: []
    }
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
    (input) => generator.genClass(input, input, ['Object']),
    'MyNewClass',
    validateTypeName('class')
  )
}

function newIface () {
  InputView.show('Choose a name for your new interface',
    (input) => generator.genIface(input, input, ['Object']),
    'MyNewInterface',
    validateTypeName('interface')
  )
}

function surround () {
  // get selected text
  const editor = atom.workspace.getActiveTextEditor()
  const sel = editor.getSelectedBufferRange()
  const lines = editor.getTextInBufferRange(sel).split('\n')
  const tab = editor.getTabText() // text used for tabs(`  `, `    `, `\t`, ...)

  const indent = {}
  const currentIndentLevel = (lines[lines.length - 1].match(tab) || []).length
  indent.surrounder = tab.repeat(currentIndentLevel)
  if (sel.start.column !== 0) { // didn't selected the beginning of the line
    indent.firstLine = tab.repeat(currentIndentLevel + 1)
  } else {
    indent.firstLine = indent.surrounder
  }

  const newText = `${indent.firstLine}${lines.join('\n' + tab)}`
  const bufferToReplace = sel
  bufferToReplace.start.column = 0
  editor.setTextInBufferRange(bufferToReplace, `${indent.surrounder} {
${newText}
${indent.surrounder}}`)
  const newSel = [sel.start.row, sel.start.column + indent.surrounder.length]
  editor.setSelectedBufferRange([newSel, newSel])
}

// Integration with other packages
export const getProvider = () => [ new ValaProvider(), new DocProvider() ]
export const getBuilder = () => ValacBuilder
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
export function consumeLinter (register) {
  linter = register({
    name: 'Valhalla'
  })
  subscriptions.add(linter)
}
