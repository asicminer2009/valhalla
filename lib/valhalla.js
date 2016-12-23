'use babel';

import InputView from './input-view';
import { CompositeDisposable } from 'atom';
import ValaProvider from './provider';
import Generator from './generator';
import DocViewer from './doc-viewer';
import ValacBuilder from './builder';
import ScopeManager from './scopes';
import { spawnSync, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import request from 'request';

const docProtocol = 'valadoc://';
const debug = true;

DocViewer.name = 'DocViewer';
atom.deserializers.add(DocViewer);

export default {

    config: {
        vapiDir: {
            type: 'string',
            default: '/usr/share/vala/vapi/:/usr/share/vala-0.32/vapi/',
            title: 'Vapi files directory. You can use ' + path.delimiter + ' as a separator if you have many directories.',
        },
        valacArgs: {
            type: 'string',
            title: 'Valac custom arguments',
            description: 'To use with the atom-build package. If not specified, it will just build all the files of your project.',
            default: ''
        },
        glibVersion: {
            type: 'string',
            default: '2.48.1',
            title: 'The GLib version you are using'
        },
        firstTime: {
            type: 'boolean',
            default: true,
            title: 'Check this if you want to reset your settings.'
        }
    },

    subscriptions: null,
    manager: null,
    linter: null,

    getVapiDir() {
        if(process.platform === 'linux') {
            return '/usr/share/vala/vapi/:/usr/share/vala-0.32/vapi/';
        } else if(process.platform === 'win32') {
            return 'C:\\ProgramData\\vala-0.20\\vapi\\';
        }
    },

    activate(state) {
        // configure at first launch
        if(atom.config.get('valhalla.firstTime')) {
            atom.config.set('valhalla.vapiDir', this.getVapiDir());
            let pkgConf = spawnSync('pkg-config', ['--modversion', 'glib-2.0'], {});
            atom.config.set('valhalla.glibVersion', pkgConf.stdout.toString().replace('\n', ''));
            atom.config.set('valhalla.firstTime', false);
        }

        // class/interface generators
        this.generator = new Generator();

        this.classView = new InputView(state.classState, 'class', 'new-class', 'Please enter the name of your new class.',(input) => {
            this.generator.gen(input, 'class');
        });
        this.classPanel = atom.workspace.addModalPanel({
            item: this.classView.getElement(),
            visible: false
        });

        this.iFaceView = new InputView(state.iFaceState, 'interface', 'new-interface', 'Please enter the name of your new interface.',(input) => {
            this.generator.gen(input, 'interface');
        });
        this.iFacePanel = atom.workspace.addModalPanel({
            item: this.iFaceView.getElement(),
            visible: false
        });

        // registers commands
        this.subscriptions = new CompositeDisposable();

        this.subscriptions.add(atom.commands.add('atom-workspace', {
            'valhalla:new-class':() => this.newClass()
        }));

        this.subscriptions.add(atom.commands.add('atom-workspace', {
            'valhalla:new-interface':() => this.newIface()
        }));

        this.subscriptions.add(atom.commands.add('atom-text-editor', {
            'valhalla:surround':() => this.surround()
        }));

        // documentation
        atom.workspace.addOpener((uri) => {
            if(uri.startsWith(docProtocol)) {
                let dv = new DocViewer();
                const url = uri.replace(docProtocol, '');
                dv.load(url);
                return dv;
            }
        });

        this.subscriptions.add(atom.commands.add('atom-workspace', {
            'valhalla:documentation': () => {
                atom.workspace.open(docProtocol + '/');
            }
        }));

        // parsing code
        const vapiDir = atom.config.get('valhalla.vapiDir');

        this.manager = new ScopeManager();

        const explore = (dir) => {
            files = fs.readdirSync(dir);
            for(const file of files) {

                if(fs.statSync(path.join(dir, file)).isDirectory()) {
                    explore(path.join(dir, file));
                }

                if(file.endsWith('.vala') || file.endsWith('.vapi')) {
                    let content = fs.readFileSync(path.join(dir, file), 'utf-8');
                    this.manager.parse(content, path.join(dir, file));
                }
            }
        }

        for(const project of atom.project.getPaths()) {
            explore(project);
        }

        // spawn poulp to get errors
        let usePoulp = true;
        this.poulp = spawn('poulp', ['suggest', '--project', '.'], {cwd: atom.project.getPaths()[0]});
        this.poulp.on('error', (err) => {
          console.log(`Error while spawning poulp : ${err}`);
          usePoulp = false;
        });
        const log = (msg) => {
          if (debug) {
            console.log(`POULP: ${msg}`);
          }
        };
        this.poulp.stderr.on('data', log);
        this.poulp.stdout.on('data', log);

        let timeout;

        atom.workspace.observeTextEditors((editor) => {
            if(editor.getPath() && editor.getPath().endsWith('.vala')) {
                editor.onDidStopChanging((event) => {
                    this.manager.parse(editor.getText(), editor.getPath());
                });

                editor.onDidChange((event) => {
                  if (timeout) {
                    clearTimeout(timeout);
                  }
                  timeout = setTimeout(() => {
                    // get errors from poulp
                    if (usePoulp && this.linter) {
                      request({
                        url: 'http://localhost:4242/complete',
                        method: 'POST',
                        json: {
                          modifiedFiles: atom.workspace.getTextEditors().map((ed) => {
                            if (ed.isModified()) {
                              return {
                                path: ed.getPath(),
                                code: ed.getText()
                              };
                            }
                          }).filter((elt) => elt !== undefined && elt !== null),
                          position: {
                            file: editor.getPath(),
                            line: editor.getCursorBufferPosition().row,
                            column: editor.getCursorBufferPosition().column
                          }
                        }
                      }, (err, res, body) => {
                        if (err) {
                          console.log(`Error : ${err}`);
                          return;
                        }

                        const msgs = body.report.map ((elt) => {
                          return {
                            type: elt.type,
                            text: elt.message,
                            filePath: elt.location.file,
                            range: [[elt.location.begin.line - 1, elt.location.begin.col - 1], [elt.location.end.line - 1, elt.location.end.col]]
                          };
                        });
                        this.linter.setMessages(msgs);
                      });
                    }
                  }, 1500);
                });

                this.manager.parse(editor.getText(), editor.getPath());
            }
        });

        // loading symbols from .vapi
        for(const dir of vapiDir.split(path.delimiter)) {
            fs.readdir(dir,(err, files) => {
                if(err) {
                    console.error(err);
                    return;
                }

                for(file of files) {
                    if(file.endsWith('.vapi')) {
                        let content = fs.readFileSync(path.join(dir, file), 'utf-8');
                        this.manager.parse(content, file);
                    }
                }
            });
        }

        this.provider = new ValaProvider(this.manager.scopes);
    },

    getScopes () {
        return this.manager.scopes;
    },

    deactivate() {
        this.classPanel.destroy();
        this.iFacePanel.destroy();
        this.subscriptions.dispose();
        if (this.poulp) {
          request({
            url: 'http://localhost:4242/kill',
            method: 'GET'
          }, this.poulp.kill);
        }
    },

    serialize() {
        return {
            classState: this.classView.serialize(),
            iFaceState: this.iFaceView.serialize(),
        };
    },

    newClass() {
        return(
            this.classPanel.isVisible() ?
            this.classPanel.hide() :
            this.classPanel.show()
        );
    },

    newIface() {
        return(
            this.iFacePanel.isVisible() ?
            this.iFacePanel.hide() :
            this.iFacePanel.show()
        );
    },

    surround() {
        // get selected text
        const editor = atom.workspace.getActiveTextEditor();
        const sel = editor.getSelectedBufferRange();
        const txt = editor.getTextInBufferRange(sel);
        const lines = txt.split('\n');
        const tab = editor.getTabText(); // getting text used for tabs(`  `, `    `, `\t`, ...)

        const indent = {};
        const currentIndentLevel =(lines[lines.length - 1].match(tab) || []).length;
        indent.surrounder = tab.repeat(currentIndentLevel);
        if(sel.start.column != 0) { // doesn't selected the beginning of the line
            indent.firstLine = tab.repeat(currentIndentLevel + 1);
        } else {
            indent.firstLine = indent.surrounder;
        }

        const newText = indent.firstLine + lines.join('\n' + tab);
        const bufferToReplace = sel;
        bufferToReplace.start.column = 0;
        editor.setTextInBufferRange(bufferToReplace, `${indent.surrounder} {
${newText}
${indent.surrounder}}`);
        const newSel = [sel.start.row, sel.start.column + indent.surrounder.length];
        editor.setSelectedBufferRange([newSel, newSel]);
    },

    getProvider() {
        return this.provider;
    },

    getBuilder() {
        return ValacBuilder;
    },

    consumeToolBar(getBar) {
      const toolbar = getBar('valhalla');
      toolbar.addButton({
          icon: 'book',
          callback: 'valhalla:documentation',
          tooltip: 'Open Vala documentation'
      });
      toolbar.addSpacer();
    },

    consumeLinter(indieRegistry) {
      this.linter = indieRegistry.register({
        name: 'Valhalla'
      });
      this.subscriptions.add(this.linter);
    }

};
