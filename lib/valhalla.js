'use babel';

import InputView from './input-view';
import { CompositeDisposable } from 'atom';
import ValaProvider from './provider';
import Generator from './generator';
import DocViewer from './doc-viewer';
import ValacBuilder from './builder';
import { spawnSync } from 'child_process';
import * as path from 'path';

const docProtocol = 'valadoc://';

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
            description: 'To use with the atom-build package. If not specified, it willjust build all the files of your project',
            default: undefined
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

    getVapiDir() {
        if(process.platform == 'linux') {
            return '/usr/share/vala/vapi/:usr/share/vala-0.32/vapi/';
        } else if (process.platform == 'win32') {
            return 'C:\\ProgramData\\vala-0.20\\vapi\\';
        }
    },

    activate(state) {

        if (atom.config.get('valhalla.firstTime')) {
            atom.config.set('valhalla.vapiDir', this.getVapiDir());
            let pkgConf = spawnSync ('pkg-config', ['--modversion', 'glib-2.0'], {});
            atom.config.set ('valhalla.glibVersion', pkgConf.stdout.toString().replace('\n', ''));
            atom.config.set('valhalla.firstTime', false);
        }

        this.generator = new Generator();

        this.classView = new InputView(state.classState, 'class', 'new-class', 'Please enter the name of your new class.', (input) => {
            this.generator.gen(input, 'class');
        });
        this.classPanel = atom.workspace.addModalPanel({
            item: this.classView.getElement(),
            visible: false
        });

        this.iFaceView = new InputView(state.iFaceState, 'interface', 'new-interface', 'Please enter the name of your new interface.', (input) => {
            this.generator.gen(input, 'interface');
        });
        this.iFacePanel = atom.workspace.addModalPanel({
            item: this.iFaceView.getElement(),
            visible: false
        });

        // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
        this.subscriptions = new CompositeDisposable();

        // Register command that toggles this view
        this.subscriptions.add(atom.commands.add('atom-workspace', {
            'valhalla:new-class': () => this.newClass()
        }));

        this.subscriptions.add(atom.commands.add('atom-workspace', {
            'valhalla:new-interface': () => this.newIface()
        }));

        this.subscriptions.add(atom.commands.add('atom-text-editor', {
            'valhalla:surround': () => this.surround()
        }));

        this.provider = new ValaProvider();

        atom.workspace.addOpener((uri) => {
            if (uri.startsWith(docProtocol)) {
                let dv = new DocViewer(this.provider.manager.scopes);
                dv.load(uri.replace(docProtocol, ''));
                return dv;
            }
        });

        this.subscriptions.add(atom.commands.add('atom-workspace', {
            'valhalla:documentation': () => {
                atom.workspace.open(docProtocol + '/');
            }
        }));
    },

    deactivate() {
        this.classPanel.destroy();
        this.iFacePanel.destroy();
        this.subscriptions.dispose();
    },

    serialize() {
        return {
            classState: this.classView.serialize(),
            iFaceState: this.iFaceView.serialize(),
        };
    },

    newClass() {
        return (
            this.classPanel.isVisible() ?
            this.classPanel.hide() :
            this.classPanel.show()
        );
    },

    newIface() {
        return (
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
        const tab = editor.getTabText(); // getting text used for tabs (`  `, `    `, `\t`, ...)

        const times = (str, fact) => {
            let res = '';
            for (let i = 0; i < fact; i++) {
                res += str;
            }
            return res;
        }

        const indent = {};
        const currentIndentLevel = (lines[lines.length - 1].match(tab) || []).length;
        indent.surrounder = times(tab, currentIndentLevel);
        if (sel.start.column != 0) { // doesn't selected the beginning of the line
            indent.firstLine = times(tab, currentIndentLevel + 1);
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

    getBuilder () {
        return ValacBuilder;
    },

    consumeToolBar (getBar) {
        if (getBar) {
            const toolbar = getBar('valhalla');
            toolbar.addSpacer();
            toolbar.addButton({
                icon: 'book',
                callback: 'valhalla:documentation',
                tooltip: 'Open Vala documentation'
            });
        }
    }

};
