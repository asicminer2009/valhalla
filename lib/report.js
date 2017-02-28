'use babel'

import { Emitter } from 'atom'

export default class Report {
  constructor () {
    this.reports = []
    this.emitter = new Emitter()
  }

  error (msg, line, col, path) {
    this.report(msg, line, col, path, 'error')
  }

  warning (msg, line, col, path) {
    this.report(msg, line, col, path, 'warning')
  }

  report (msg, line, col, path, type) {
    let endLine = line
    let endCol = col + 1

    if (line instanceof Array) {
      const limits = [line[0], line[1]]
      line = limits[0]
      endLine = limits[1]
    }

    if (col instanceof Array) {
      const limits = [col[0], col[1]]
      col = limits[0]
      endCol = limits[1]
    }

    const newReport = {
      message: msg,
      begin: {
        line: line,
        column: col
      },
      end: {
        line: endLine,
        column: endCol
      },
      file: path,
      type: type
    }
    this.reports.push(newReport)
    this.emitter.emit('new-report', newReport)
  }

  clear (path) {
    if (path) {
      this.reports = this.reports.filter(rep => {
        return rep.file !== path
      })
    } else {
      this.reports = []
    }
    this.emitter.emit('new-report', {})
  }

  onNewReport (cb) {
    return this.emitter.on('new-report', cb)
  }
}
