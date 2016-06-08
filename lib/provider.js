'use babel';

import * as fs from 'fs';
import ScopeManager from './scopes';

export default class ValaProvider {
    constructor() {
        const vapiDir = atom.config.get('valhalla.vapiDir');

        this.re = {
            ns: /namespace (\S+)/,
            using: /^using /,
            cls: /(public |private |internal )class (\w+)( : (\S+))?( ?{)?/,
            isCls: / ?class /,
            method: /(public |private |internal )?(static )?(\w+) (\w+) ?\((.*)\)( {)?/,
            prop: /(public |private |internal )(static )?(\S*) (\S*)( ?{)?/,
            member: /(public|private|internal) (\w+) (.+)/,
            par: /\(.*\)/,
            dot: /\./
        };

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

        // loading symbols from .vapi
        fs.readdir (vapiDir, (err, files) => {
            if (err) {
                console.log (err);
                return;
            }

            files.forEach ((file) => {
                if (file.endsWith ('.vapi')) {
                    fs.readFile (vapiDir + file, 'utf-8', (err, content) => {
                        if (err) {
                            console.log (err);
                            return;
                        }
                        this.manager.parse(content, file);
                    });
                }
            });
        });
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
        let i = 1, endUsing = 0;
        editor.getText().split('\n').forEach((line) => {
            var usingRe = /^using (.*);/;
            var usingMatch = line.match (usingRe);
            if (usingMatch) {
                usings.push(usingMatch[1]);
                endUsing = i;
            }
            let nsMatch = line.match(this.re.ns);
            if (nsMatch) {
                usings.push(nsMatch[1]);
            }
            i++;
        });

        return new Promise ((resolve) => {
            var suggestions = [];
            var possibleSymbols = []; // possible symbols for local variables
            let suggestionType = [];

            let _prefix = prefix.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");

            let newMatch = line.match('new ' + _prefix);
            let thisMember = line.match(/this\./); // shows if we are looking for a member of this or not

            let thisScope, topScope;

            let explore = (scope) => {

                // getting top scope
                if (!topScope && scope.file == editor.getPath() && scope.name == '{{global}}') {
                    topScope = scope;
                }

                // loading possible namespaces
                let nsMatch = scope.name.match(this.re.ns);
                if (scope.vapi && nsMatch && line.match(this.re.using) && nsMatch[1].match(prefix)) {
                    let name = nsMatch[1];
                    let parent = scope;
                    while (parent.top) {
                        let topMatch = parent.top.name.match(this.re.ns);
                        if (topMatch) {
                            name = topMatch[1] + '.' + name;
                        }
                        parent = parent.top;
                    }

                    haveSubNs = false;
                    scope.children.forEach((child) => {
                        if (!haveSubNs && child.name.match(this.re.ns)) haveSubNs = true;
                    });

                    let suggestion = {
                        text: name + (haveSubNs ? '' : ';'),
                        type: 'import',
                        displayText: name,
                        description: 'You should compile with the ' + scope.file.replace ('.vapi', '') + ' package.',
                        descriptionMoreURL: 'http://valadoc.org/#!api=' + scope.file.replace ('.vapi', '') + '/' + nsMatch[0]
                    };
                    suggestions.push(suggestion);
                }

                // list possible classes, when writing `new ...`
                if (newMatch) {
                    let clsMatch = scope.name.match(this.re.cls)
                    if (clsMatch && clsMatch[2].match(prefix)) {
                        let ctor = clsMatch[2] + ' ();';
                        scope.children.forEach((child) => {
                            let methMatch = child.name.match(this.re.method);
                            if (methMatch && methMatch[4] == clsMatch[2]) {
                                ctor = clsMatch[2];
                                ctor += ' (';
                                let args = methMatch[5].split(',');
                                args.forEach((arg, j) => {
                                    if (arg.length > 0) {
                                        let argPart = arg.split(' ');
                                        ctor += argPart[argPart.length - 1];
                                        if (j < args.length - 1) {
                                            ctor += ', ';
                                        }
                                    }
                                });
                                ctor += ');'
                            }
                        });
                        if (scope.top) {
                            let ns = scope.top.name.match(this.re.ns);
                            if (ns && usings.includes(ns[1])) {
                                suggestions.unshift({
                                    text: ctor,
                                    displayText: clsMatch[2],
                                    type: 'class',
                                    leftLabel: ns[1]
                                });
                            } else {
                                if (suggestions.length < 5) {
                                    suggestions.push({
                                        text: ctor,
                                        displayText: clsMatch[2],
                                        type:'class',
                                        leftLabel: ns ? ns[1] : '',
                                        afterInsert: (editor) => {
                                            if (ns) {
                                                let rng = [[endUsing, 0], [endUsing, 0]];
                                                editor.setTextInBufferRange(rng, `using ${ns[1]};\n`);
                                            }
                                        }
                                    });
                                }
                            }
                        } else {
                            suggestions.push({
                                text: ctor,
                                displayText: clsMatch[2],
                                type: 'class'
                            });
                        }
                    }

                }

                let methMatch = scope.name.match(this.re.method);
                if (methMatch && methMatch[3] != 'class' && methMatch[3] != 'interface') {
                    if (methMatch[4] == 'print') {
                        console.log (' found print ', scope);
                    }
                    possibleSymbols.push(scope);
                    let topMatch = scope.top.name.match(this.re.ns);
                    if (topMatch) console.log(' TOP ! ', topMatch);
                    if (topMatch && usings.includes(topMatch[1]) && methodMatch[4].match(_prefix)) {
                        suggestions.push(this.suggestMethod(scope));
                    }
                }

                let propMatch = scope.name.match(this.re.prop);
                if (propMatch && propMatch[3] != 'class' && propMatch[3] != 'interface') {
                    possibleSymbols.push(scope);
                }

                if (scope.file == editor.getPath() && scope.at[0][0] <= bufferPosition.row && scope.at[1][0] >= bufferPosition.row + 1) {
                    if (!thisScope && scope.name.match(this.re.isCls)) {
                        thisScope = scope;
                        topScope = scope;
                    }

                    // setting arguments as local variables
                    // do it in scopes.js ?
                    let metM = scope.name.match(this.re.method);
                    if (metM) {
                        let args = metM[5];
                        args.split(',').filter((arg) => {
                            return arg != ''
                        }).forEach((arg) => {
                            let part = arg.split(' ');
                            part = part.filter((p) => {
                                return p != ''
                            });
                            let sugg = {
                                name: part[1],
                                type: part[0],
                                isConst: false,
                                initialValue: 'null',
                                line: scope.at[0][0]
                            };
                            scope.vars.push(sugg);
                        });
                    }

                    // local variables
                    scope.vars.forEach((localVar) => {
                        if (line.trim().match(localVar.name + '\\.')) {
                            let lineParts = line.split(localVar.name + '.');
                            let endOfLine = lineParts[lineParts.length - 1];
                            endOfLine = endOfLine.split('.')
                            endOfLine.pop();
                            let expr = endOfLine.join('.');
                            let type;
                            console.log(expr);
                            if (expr == '') {
                                type = localVar.type;
                            } else {
                                type = this.getType(localVar.type, expr);
                            }
                            possibleSymbols.forEach((symbol) => {
                                let topMatch = symbol.top.name.match(this.re.cls);
                                if (topMatch && type && type != 'void' && topMatch[2] == type) {
                                    if (symbol.name.includes('(') && symbol.name.includes(')')) {
                                        let sugg = this.suggestMethod(symbol);
                                        // don't take it if it's a constructor
                                        if (sugg && sugg.text != topMatch[2] && (sugg.text.match(_prefix) || prefix == '.')) {
                                            suggestions.push(sugg);
                                        }
                                    } else {
                                        let sugg = this.suggestProperty(symbol);
                                        if (sugg && (sugg.text.match(_prefix) || prefix == '.')) {
                                            suggestions.push(sugg);
                                        }
                                    }
                                }
                            });
                        }

                        // add local variables matching the prefix
                        if (localVar.name.match(_prefix) && !line.endsWith('.' + prefix) && localVar.line <= bufferPosition.row) {
                            let sugg = {
                                text: localVar.name,
                                type: 'variable',
                                leftLabel: localVar.type
                            };

                            // if variable have a doc (for parameters of method) show it
                            if (scope.documentation.param) {
                                scope.documentation.param.forEach((param) => {
                                    if (param.split(' ')[0] == sugg.text) {
                                        sugg.description = param.replace(sugg.text + ' ', '');
                                    }
                                });
                            }

                            suggestions.unshift(sugg);
                        }
                    });
                }

                if (thisScope) {
                    thisScope.children.forEach((child) => {

                        let methodMatch = child.name.match(this.re.method);
                        let propMatch = child.name.match(this.re.prop);

                        if (methodMatch && thisMember) {
                            let sugg = this.suggestMethod(child);
                            if (sugg) {
                                suggestions.unshift(sugg);
                            }
                        } else if (propMatch && thisMember) {
                            suggestions.push({
                                text: propMatch[4],
                                leftLabel: propMatch[3],
                                type: 'property',
                                description: child.documentation.short
                            });
                        }
                    });
                }

                if (topScope) {
                    topScope.children.forEach((scope) => {
                        // if the scope is a method
                        let methodMatch = scope.name.match(this.re.method);
                        if (methodMatch) {
                            // if we are in a class, don't do anything
                            if (!scope.top.name.match(this.re.isCls)) {
                                // don't take it if not matching the prefix
                                if (!methodMatch[4].match(_prefix) || line.endsWith('.' + prefix)) return;

                                let sugg = this.suggestMethod(scope);
                                if (sugg) {
                                    suggestions.unshift(sugg);
                                }
                            } else if (methodMatch[2] == 'static ') { // we can also show it if it's a static method, even if in a class

                                // don't take it if not matching the prefix
                                if (!methodMatch[4].match(_prefix) || line.endsWith('.' + prefix)) return;

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
               div.textContent = 'this isn\'t valid here. You are not in a class.'
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

    suggestMethod (scope) {

        let methodMatch = scope.name.match(this.re.method);
        if (methodMatch) {
            let isStatic = methodMatch[2] == 'static ';

            // it's a constructor, not a method, so we break
            if (methodMatch[3].match(/(public|private|internal)/)) return;

            let meth = methodMatch[4] + ' (';

            // generating html description for method parameters
            let args = methodMatch[methodMatch.length - 2].split(',');
            let argDesc = '';
            args.forEach((arg, j) => {
                if (arg.length > 0) {
                    let argPart = arg.split(' ');
                    argPart.filter((part) => { return (part.length > 0 && part != 'ref' && part != 'out'); }).forEach((part, i) => {
                        if (part.length > 0 && i < 2) {
                            if (i % 2 != 0) {
                                meth += part;
                                argDesc += `<span class="variable parameter vala">${part}</span>`;
                            } else {
                                if (j > 0) {
                                    meth += ', ';
                                    argDesc += ', ';
                                }

                                argDesc += `<span class="storage type">${part}</span> `;
                            }
                        }

                    });
                }
            });

            meth += ');';

            return {
                text: meth,
                displayText: methodMatch[methodMatch.length - 3],
                leftLabel: (isStatic ? '(static) ' : '') + methodMatch[methodMatch.length - 4],
                rightLabelHTML: argDesc,
                type: 'method',
                description: scope.documentation.short
            };
        }
    }

    suggestProperty (scope) {
        let propertyMatch = scope.name.match(this.re.prop);
        if (propertyMatch) {
            return {
                text: propertyMatch[4],
                leftLabel: propertyMatch[3],
                type: 'property'
            };
        }
    }

    getType (type, expr) {
        while (expr.match(this.re.par)) {
            expr = expr.replace(this.re.par, '');
            expr = expr.replace(' ', '');
        }
        if (expr.includes('.')) {
            let t = type;
            expr.split('.').forEach((subEx) => {
                t = this.getType(t, subEx);
            });
            return t;
        } else {
            let t;
            let explore = (scope) => {
                let clsMatch = scope.name.match(this.re.cls);
                if (clsMatch && clsMatch[2] == type) {
                    t = scope;
                } else {
                    scope.children.forEach((child) => {
                        explore (child);
                    });
                }
            }

            this.manager.scopes.forEach((scope) => {
                explore (scope);
            })

            if (t) {
                for (var child of t.children) {
                    let methMatch = child.name.match(this.re.method);
                    let propMatch = child.name.match(this.re.prop);

                    if (methMatch) {
                        // if not a constructor
                        if (methMatch[3] != 'public' && methMatch[3] != 'internal' && methMatch[3] != 'private' && methMatch[4] == expr) {
                            let res = methMatch[3].split('.');
                            return res[res.length - 1];
                        }
                    } else if (propMatch && propMatch[4] == expr) {
                        let res = propMatch[3].split('.');
                        return res[res.length - 1];
                    }
                }
            }
            return 'void';
        }
    }

    onDidInsertSuggestion ({editor, triggerPosition, suggestion}) {
        if (suggestion.afterInsert) {
            suggestion.afterInsert(editor);
        }
    }
}
