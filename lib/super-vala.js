'use babel';

import SuperValaView from './super-vala-view';
import { CompositeDisposable } from 'atom';
import ValaProvider from './provider';

export default {

    config: {
        vapiDir: {
            type: 'string',
            default: 'C:\\ProgramData\\vala-0.20\\vapi\\',
            title: 'Vapi files directory',
        }
    },

    superValaView: null,
    modalPanel: null,
    subscriptions: null,

    activate(state) {
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
