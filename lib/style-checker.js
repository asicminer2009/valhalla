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

    if (line.trimRight().length < line.length) {
      report.warning('Trailing spaces are not allowed.', lineNum, [line.trimRight().length + 1, line.length + 1], path)
    }
  }
}
