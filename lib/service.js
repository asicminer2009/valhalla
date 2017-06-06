'use babel'

import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'

function stat (file) {
  return new Promise((resolve, reject) => {
    fs.stat(file, (err, stats) => {
      if (err) {
        reject(err)
        return
      }
      resolve(stats)
    })
  })
}

function readDir (dir) {
  return new Promise((resolve, reject) => {
    fs.readdir(dir, (err, children) => {
      if (err) {
        reject(err)
        return
      }
      resolve(children)
    })
  })
}

async function walk (dir, filter, blacklist = []) {
  let files = []
  const dirChildren = await readDir(dir)

  for (const file of dirChildren) {
    const completePath = path.join(dir, file)
    const stats = await stat(completePath)

    if (stats.isDirectory() && !file.startsWith('.') && !blacklist.includes(file)) {
      files = files.concat(await walk(completePath, filter, blacklist))
    } else if (filter(file)) {
      files.push(completePath)
    }
  }
  return files
}

let port = 8022

export default class Service {
  constructor (projectPath) {
    this.project = projectPath
    this.init()
  }

  init () {
    this.port = port++
    walk(this.project, file =>
      file.endsWith('.vala') || file.endsWith('.gs') || file.endsWith('.c') || file.endsWith('.h') || file.endsWith('.vala'),
      [ 'build', 'node_modules' ]
    ).then(this.ready.bind(this))
  }

  get url () {
    return `http://localhost:${this.port}`
  }

  stop () {
    this.service.kill()
  }

  async refresh () {
    await fetch(`${this.url}/refresh`)
  }

  async fetchErrors () {
    const res = await fetch(`${this.url}/errors`)
    const errs = await res.json()
    return errs
  }

  async getAst () {
    if (this.servUpdated || !this.ast) {
      this.servUpdated = false
      const res = await fetch(`${this.url}/ast`)
      this.ast = await res.json()
    }
    return this.ast
  }

  async symbol (id) {
    const res = await fetch(`${this.url}/symbol`, {
      method: 'POST',
      body: JSON.stringify({
        id
      })
    })
    const json = await res.json()
    return json.children[0]
  }

  ready (files) {
    const serviceCmd = path.join(atom.packages.getActivePackage('valhalla').path, 'server', 'build', process.platform === 'win32' ? 'completer.exe' : 'completer')

    this.files = files

    this.service = spawn(serviceCmd, [this.port])
    this.service.stdout.on('data', this.onOutput.bind(this))

    this.service.stderr.on('data', this.onError.bind(this))

    this.service.on('close', code => {
      console.log(`Service exited with ${code}`)
    })
  }

  onError (data) {
    if (data.includes('priv-listeners != NULL')) { // LibSoup says that the port is already in use
      this.init() // we restart with another port
    } else {
      console.error(`stderr: ${data}`)
    }
  }

  onOutput (data) {
    const gotPackages = packages => {
      fetch(`${this.url}/options`, {
        method: 'POST',
        body: JSON.stringify({
          files: this.files,
          packages
        })
      })
    }
    if (data.includes('Vala service now running')) {
      atom.config.observe('valhalla.packages', gotPackages.bind(this))
    }
    if (data.includes('[[UPDATED]]')) {
      this.servUpdated = true
    } else {
      console.log(`stdout: ${data}`)
    }
  }
}