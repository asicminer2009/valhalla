'use babel';

import Valhalla from '../lib/valhalla';
import ValaProvider from '../lib/provider';
import ScopeManager from '../lib/scopes';
import * as fs from 'fs';
import * as path from 'path';

// Use the command `window:run-package-specs` (cmd-alt-ctrl-p) to run specs.
//
// To run a specific `it` or `describe` block add an `f` to the front (e.g. `fit`
// or `fdescribe`). Remove the `f` to unfocus the block.

describe('Valhalla', () => {
    let activationPromise;

    beforeEach(() => {
        activationPromise = atom.packages.activatePackage('valhalla');
    });
    it('can determine the type of an expression', () => {
        const manager = new ScopeManager();
        const vapiDir = atom.config.get('valhalla.vapiDir');

        const explore = (dir) => {
            files = fs.readdirSync(dir);
            for(const file of files) {

                if(fs.statSync(path.join(dir, file)).isDirectory()) {
                    explore(path.join(dir, file));
                }

                if(file.endsWith('.vala') || file.endsWith('.vapi')) {
                    let content = fs.readFileSync(path.join(dir, file), 'utf-8');
                    manager.parse(content, path.join(dir, file));
                }
            }
        }

        for(const project of atom.project.getPaths()) {
            explore(project);
        }
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
                        manager.parse(content, file);
                    }
                }
            });
        }

        const provider = new ValaProvider(manager.scopes);

        expect(provider.getType('ArrayList<string>', 'add(gg)', ['Gee']).base.data.name).toEqual('void');
        expect(provider.getType('string', 'up().down()', ['GLib']).base.data.name).toEqual('string');
        const a = provider.getType('ArrayList<string>', '', ['Gee']).generics[0];
        console.log (a);
        expect(a.data.name).toEqual('string');
    });
});
