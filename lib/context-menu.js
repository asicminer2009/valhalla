'use babel'

import { CompositeDisposable } from 'atom'

const subscriptions = new CompositeDisposable()

export function setup (editor) {
  const selector = '.syntax--entity.syntax--name.syntax--type.syntax--class.syntax--vala'
  editor.onDidStopChanging(() => {
    const classNames = []

    const potentialClassDecl = Array.prototype.slice.call(
      editor.element.querySelectorAll(selector), 0)

    for (const clsDecl of potentialClassDecl) {
      if (clsDecl.parentElement.innerText.startsWith('class')) {
        classNames.push(clsDecl)
      }
    }

    if (classNames.length > 0) {
      const menuItem = {}
      menuItem[`atom-text-editor ${selector}`] = [{
        label: 'Create a child class',
        command: 'valhalla:create-child-class',
        shouldDisplay: (evt) => {
          return classNames.includes(evt.target)
        }
      },
      {
        type: 'separator'
      }]

      subscriptions.add(atom.contextMenu.add(menuItem))
    }
  })
}

export function dispose () {
  subscriptions.dispose()
}
