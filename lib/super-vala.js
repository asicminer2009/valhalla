'use babel';

import SuperValaView from './super-vala-view';
import { CompositeDisposable } from 'atom';
import ValaProvider from './provider';

export default {

    config: {
        vapiDir: {
            type: 'string',
            default: '/usr/share/vala/vapi/',
            title: 'Vapi files directory',
        },
        firstTime: {
            type: 'boolean',
            default: true,
            title: 'Check this if you want to reset your settings.'
        }
    },

    superValaView: null,
    modalPanel: null,
    subscriptions: null,

    getVapiDir() {
        if(process.platform == 'linux') {
            return '/usr/share/vala/vapi/';
        } else if (process.platform == 'win32') {
            return 'C:\\ProgramData\\vala-0.20\\vapi\\';
        }
    },

    activate(state) {

        if (atom.config.get('super-vala.firstTime')) {
            atom.config.set('super-vala.vapiDir', this.getVapiDir());
            atom.config.set('super-vala.firstTime', false);
        }

        this.superValaView = new SuperValaView(state.superValaViewState);
        this.modalPanel = atom.workspace.addModalPanel({
            item: this.superValaView.getElement(),
            visible: false
        });

        // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
        this.subscriptions = new CompositeDisposable();

        // Register command that toggles this view
        this.subscriptions.add(atom.commands.add('atom-workspace', {
            'super-vala:toggle': () => this.toggle()
        }));
    },

    deactivate() {
        this.modalPanel.destroy();
        this.subscriptions.dispose();
        this.superValaView.destroy();
    },

    serialize() {
        return {
            superValaViewState: this.superValaView.serialize()
        };
    },

    toggle() {
        console.log('SuperVala was toggled!');
        return (
            this.modalPanel.isVisible() ?
            this.modalPanel.hide() :
            this.modalPanel.show()
        );
    },

    getProvider() {
        var provider = new ValaProvider();
        return provider;
    }

};
