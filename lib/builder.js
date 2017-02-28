'use babel'

import fs from 'fs'
import path from 'path'
import {report} from './valhalla'

export default class ValacBuilder {
  constructor (cwd) {
    this.errMatch = '(?<file>[\\/\\w\\.]+):(?<line>\\d+).(?<col>\\d+)(-(?<line_end>\\d+).(?<col_end>\\d+))?:\\s+error:\\s+(?<message>.+)'
    this.warnMatch = '(?<file>[\\/\\w\\.]+):(?<line>\\d+).(?<col>\\d+)(-(?<line_end>\\d+).(?<col_end>\\d+))?:\\s+warning:\\s+(?<message>.+)'
    this.cwd = cwd
    this.buildType = 'vanilla'
    this.dirs = new Set([])
  }

  getNiceName () {
    return 'Vala builder'
  }

  isEligible () {
    let foundValaFile = false
    let foundMakefile = false
    const explore = (dir) => {
      fs.readdirSync(dir, 'utf-8', (files, err) => {
        if (err) {
          report.error(err.message)
          return
        }

        for (const file of files) {
          if (fs.statSync(path.join(dir, file)).isDirectory() && !(['node_modules', '.git'].includes(dir))) {
            explore(path.join(dir, file))
          }

          if (file.endsWith('.vala')) {
            this.dirs.add(dir)
            foundValaFile = true
          }

          if (file.endsWith('.vproj.in') || file.endsWith('.vproj')) {
            this.manfifestPath = file
            this.buildType = 'vproj'
          }

          if (file === 'poulp.json') {
            this.buildType = 'poulp'
          }

          if (file === 'Makefile') {
            foundMakefile = true
          }
        }
      })
    }
    explore(this.cwd)

    return foundValaFile && !foundMakefile
  }

  settings () {
    const builders = []
    switch (this.buildType) {
      case 'poulp':
        builders.push({
          cmd: 'poulp',
          name: 'poulp',
          args: ['build'],
          errorMatch: this.errMatch,
          warningMatch: this.warnMatch
        })
        break
      case 'vproj':
        const manifest = JSON.parse(fs.readFileSync(path.join(this.cwd, this.manifestPath)))
        const args = []
        args.push('-o')
        args.push(manifest.name + '-' + manifest.version)
        for (const pkg of manifest.packages) {
          args.push('--pkg')
          args.push(pkg)
        }
        for (const prop of manifest.flags) {
          args.push('--' + prop)
          args.push(manifest.flags[prop])
        }
        builders.push({
          cmd: 'valac',
          name: 'Vproj',
          args: args,
          errorMatch: this.errMatch,
          warningMatch: this.warnMatch
        })
        break
      case 'vanilla': // just use valac
      default:
        const customArgs = atom.config.get('valhalla.valacArgs')
        builders.push({
          exec: 'valac',
          name: 'Vanilla valac',
          args: customArgs !== '' ? customArgs : [...this.dirs].map((dir) => {
            return path.join(dir, '*.vala')
          }), // TODO : make it smarter
          errorMatch: this.errMatch,
          warningMatch: this.warnMatch
        })
        break
    }
    return builders
  }
}
