'use babel';

import * as fs from 'fs';
import ScopeManager from './scopes';

export default class ValaProvider {
    constructor(serializedState) {
        const vapiDir = atom.config.get('super-vala.vapiDir');

        this.manager = new ScopeManager();

        atom.workspace.observeTextEditors((editor) => {
            if (editor.getPath() && editor.getPath().match(/\.vala$/)) {
                editor.onDidStopChanging((event) => {
                    this.manager.parse(editor.getText(), editor.getPath());
                });
                this.manager.parse(editor.getText(), editor.getPath());
            }
        });

        // autocomplete-plus
        this.selector = '.source.vala';
        this.inclusionPriority = 10;
        this.excludeLowerPriority = true;

        if (!serializedState && serializedState.knownSymbols) {
            this.knownSymbols = serializedState.knownSymbols;
        } else {
            // loading symbols from .vapi
            console.log('loading vapi ...');
            this.knownSymbols = [];
            fs.readdir (vapiDir, (err, files) => {
                if (err) {
                    console.log (err);
                    return;
                }

                files.forEach ((file) => {
                    if (file.endsWith ('valse.vapi')) {
                        fs.readFile (vapiDir + file, 'utf-8', (err, content) => {
                            if (err) {
                                console.log (err);
                                return;
                            }
                            //this.knownSymbols = this.knownSymbols.concat(this.loadSymbols (content, file));
                            this.manager.parse(content, file);
                        });
                    }
                });
            });
        }
    }

    serialize () {
        return {
            knownSymbols: this.knownSymbols
        };
    }

    getSuggestions ({editor, bufferPosition, scopeDescriptor, prefix, activatedManually}) {
        this.manager.scopes.sort((a, b) => {
            if (a.vapi && !b.vapi) {
                return -1;
            }

            if (b.vapi && !a.vapi) {
                return 1;
            }

            return 0;
        });
        var line = editor.getTextInRange([[bufferPosition.row, 0], bufferPosition]);
        var usings = ['GLib'];
        editor.getText().split('\n').forEach((line) => {
            // TODO: add current namespace to used ones
            var usingRe = /^using (.*);/;
            var usingMatch = line.match (usingRe);
            if (usingMatch) {
                usings.push(usingMatch[1]);
            }
        });

        return new Promise ((resolve) => {
            var suggestions = [];
            var possibleSymbols = []; // possible symbols for local variables
            let suggestionType = [];

            // TODO: Put all the regex in "global" variables
            let newMatch = line.match('new ' + prefix);
            let nsRe = /namespace (\S*)/,
                clsRe = /(public |private |internal )class (\S*) : (\S*)( ?{)?/,
                methodRe = /(public |private |internal )?(static )?(\w+) (\w+) ?\((.*)\)( {)?/,
                propRe = /(public |private |internal )(static)?(\S*) (\S*)( {)?/;
            let thisMember = line.match(/this\./); // shows if we are looking for a member of this or not

            let thisScope, topScope;

            let explore = (scope) => {

                // getting top scope
                if (!topScope && scope.file == editor.getPath() && scope.name == '{{global}}') {
                    topScope = scope;
                }

                // loading possible namespaces
                // TODO: add parent ns
                let nsMatch = scope.name.match(nsRe);
                if (scope.vapi && nsMatch && line.match(/^using /) && nsMatch[1].match(prefix)) {
                    let suggestion = {
                        text: nsMatch[1] + ';',
                        type: 'import',
                        displayText: nsMatch[1],
                        description: 'You should compile with the ' + scope.file.replace ('.vapi', '') + ' package.',
                        descriptionMoreURL: 'http://valadoc.org/#!api=' + scope.file.replace ('.vapi', '') + '/' + nsMatch[0]
                    };
                    suggestions.push(suggestion);
                }

                if (newMatch) {
                    // TODO: check if class is in a used namespace
                    let clsMatch = scope.name.match(/(public |private |internal )?class (\S*)/)
                    if (clsMatch && clsMatch[2].match(prefix)) {
                        let suggestion = {
                            text: clsMatch[2],
                            type: 'class'
                        };
                        // TODO: Add constructor automatically
                        suggestions.push(suggestion);
                    }

                }

                let methMatch = scope.name.match(methodRe);
                if (methMatch && methMatch[3] != 'class' && methMatch[3] != 'interface') {
                    possibleSymbols.push(scope);
                }

                let propMatch = scope.name.match(propRe);
                if (propMatch && propMatch[3] != 'class' && propMatch[3] != 'interface') {
                    possibleSymbols.push(scope);
                }

                if (scope.file == editor.getPath() && scope.at[0][0] <= bufferPosition.row && scope.at[1][0] >= bufferPosition.row + 1) {
                    if (!thisScope && scope.name.match(/ ?class /)) {
                        thisScope = scope;
                        topScope = scope;
                    }

                    // local variables
                    // TODO: suggest arguments as local variables
                    scope.vars.forEach((localVar) => {
                        // TODO: do it for expression like that -> a_var.a_method().a_prop.another_method();
                        if (line.trim().match(localVar.name + '\\.')) {
                            possibleSymbols.forEach((symbol) => {
                                let topMatch = symbol.top.name.match(clsRe);
                                if (topMatch && topMatch[2] == localVar.type) {
                                    if (symbol.name.includes('(') && symbol.name.includes(')')) {
                                        let sugg = this.suggestMethod(symbol);
                                        // don't take it if it's a constructor
                                        if (sugg && sugg.text != topMatch[2]) {
                                            suggestions.push(sugg);
                                        }
                                    } else {
                                        // TODO: fix it
                                        // TODO: create a method to generate properties suggestions
                                        let propertyMatch = symbol.name.match(propRe);
                                        if (propertyMatch) {
                                            suggestions.push({
                                                text: propertyMatch[4],
                                                leftLabel: propertyMatch[3]
                                            });
                                        }
                                    }
                                }
                            });
                        }

                        let _prefix = prefix.replace(/\./, '\\.');
                        if (localVar.name.match(_prefix)) {
                            let sugg = {
                                text: localVar.name,
                                type: 'variable',
                                leftLabel: localVar.type
                            };
                            suggestions.unshift(sugg);
                        }
                    });
                }

                // TODO: optimize this part
                if (thisScope) {
                    thisScope.children.forEach((child) => {
                        let memberMatch = child.name.match(/(public|private|internal) (\w+) (.+)/);
                        if (memberMatch) console.log(memberMatch);
                        if (memberMatch && thisMember && memberMatch[2] != 'class' && memberMatch[2] != 'interface') {
                            let type = memberMatch[2];
                            let def = memberMatch[3];
                            if (def.match(prefix)) {
                                if (def.match(/\(.*\)/)) {
                                    let sugg = this.suggestMethod(child);
                                    if (sugg) {
                                        suggestions.unshift(sugg);
                                    }
                                    //suggestionType.push('local');
                                } else {
                                    let propName = def.split('{')[0].trim();
                                    suggestions.push({
                                        text: propName,
                                        leftLabel: type,
                                        type: 'property',
                                        description: child.documentation.short
                                    });
                                    //suggestionType.push('local');
                                }
                            }

                        }
                    });
                }

                if (topScope/*suggestionType.includes('local')*/) {
                    topScope.children.forEach((scope) => {
                        // if the scope is a method
                        let methodMatch = scope.name.match(methodRe);
                        if (methodMatch) {
                            // if we are in a class, don't do anything
                            if (!scope.top.name.match(/class /)) {
                                // don't take it if not matching the prefix
                                if (!methodMatch[4].match(prefix)) return;

                                let sugg = this.suggestMethod(scope);
                                if (sugg) {
                                    suggestions.unshift(sugg);
                                }
                            } else if (methodMatch[2] == 'static ') { // we can also show it if it's a static method, even if in a class

                                // don't take it if not matching the prefix
                                if (!methodMatch[4].match(prefix)) return;

                                let sugg = this.suggestMethod(scope);
                                if (sugg) {
                                    suggestions.unshift(sugg);
                                }
                            }
                        }
                    });
                }


                // explore children
                scope.children.forEach((child) => {
                    console.log(`exploring ${child.name}`);
                    explore(child);
                });
            };

            this.manager.scopes.forEach((scope) => {
                explore(scope);
            });

            let thisMatch = line.match(/this/);
            if (!thisScope && thisMatch) {
               // shows an error if we are typing `this` when not in a class
               let range = [[bufferPosition.row, thisMatch.index], [bufferPosition.row, thisMatch.index + 4]];
               marker = editor.markBufferRange(range);
               let div = document.createElement('div');
               div.textContent = 'this isn\'t valid here.'
               div.style.padding = '10px';

               editor.decorateMarker(marker, {
                   type: 'overlay',
                   class: 'invalid',
                   item: div
               });

               window.setTimeout(() => {
                   marker.destroy();
               }, 5000);
           }

            if (line.trim() != '') {
                resolve(suggestions);
            }
        });
    }

    suggestMethod(scope) {

        let methodMatch = scope.name.match(/(public |private |internal )?(static )?(\w+) (\w+) ?\((.*)\)( {)?/);
        if (methodMatch) {
            let isStatic = methodMatch[2] == 'static ';

            // it's a constructor, not a method, so we break
            if (methodMatch[3].match(/(public|private|internal)/)) return;

            // generating html description for method parameters
            let args = methodMatch[methodMatch.length - 2].split(',');
            let argDesc = '';
            args.forEach((arg, j) => {
                if (arg.length > 0) {
                    let argPart = arg.split(' ');
                    argPart.filter((part) => { return part.length > 0 }).forEach((part, i) => {
                        if (part.length > 0 && i < 2) {
                            if (i % 2 != 0) {
                                argDesc += `<span class="variable parameter vala">${part}</span>`;
                            } else {
                                if (j > 0) argDesc += ', ';

                                argDesc += `<span class="storage type">${part}</span> `;
                            }
                        }

                    });
                }
            });

            return {
                text: methodMatch[methodMatch.length - 3],
                leftLabel: (isStatic ? '(static) ' : '') + methodMatch[methodMatch.length - 4],
                rightLabelHTML: argDesc,
                type: 'method',
                description: scope.documentation.short
            };
        }
    }
}
