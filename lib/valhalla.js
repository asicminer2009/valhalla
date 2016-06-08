'use babel';

import InputView from './input-view';
import { CompositeDisposable } from 'atom';
import ValaProvider from './provider';
import Generator from './generator';
import { spawnSync } from 'child_process';

export default {

    config: {
        vapiDir: {
            type: 'string',
            default: '/usr/share/vala/vapi/',
            title: 'Vapi files directory',
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
            return '/usr/share/vala/vapi/';
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
        let editor = atom.workspace.getActiveTextEditor();
        let sel = editor.getSelectedBufferRange();
        let txt = editor.getTextInBufferRange(sel);
        let tab = editor.getTabtext();
        txt = tab + txt;
        txt = txt.split('\n').join('\n' + tab);
        txt = txt.replace(new RegExp(tab + '$'), '');
        editor.setTextInBufferRange(sel,
`namespace Valhalla {
${txt}
}`);
    },

    getProvider() {
        return this.provider;
    }

};
