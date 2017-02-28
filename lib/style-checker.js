'use babel'

import { report } from './valhalla'

export default class StyleChecker {
  constructor () {
    this.regex = {
      parentheseSpacing: /[^ ([{]\(/
    }
  }

  check (file, path) {
    let num = 0
    for (const line of file.split('\n')) {
      this.checkLine(line, num, path)
      num++
    }
  }

  checkLine (line, lineNum, path) {
    const parentheseSpacing = line.match(this.regex.parentheseSpacing)
    if (parentheseSpacing) {
      report.warning('You forgot a space before this parenthese.', lineNum, parentheseSpacing.index + 1, path)
    }
  }
}
