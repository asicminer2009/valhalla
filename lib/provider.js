'use babel';

import * as fs from 'fs';
import ScopeManager from './scopes';

export default class ValaProvider {
    constructor() {
        const vapiDir = atom.config.get('valhalla.vapiDir');

        this.re = {
            using: /^using /,
            usingLine: /^using (.*);/,
            isCls: /class /,
            par: /\(.*\)/,
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

        // autocomplete-plus properties
        this.selector = '.source.vala';
        this.disableForSelector = '.source.vala .comment, .source.vala .string';
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
            var usingMatch = line.match (this.re.usingLine);
            if (usingMatch) {
                usings.push(usingMatch[1]);
                endUsing = i;
            }
            // TODO: add ns of the file to usings
            i++;
        });

        return new Promise ((resolve) => {
            var suggestions = [];
            var possibleSymbols = []; // possible symbols for local variables
            let suggestionType = [];

            let _prefix = prefix.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");

            let newMatch = line.match('new ' + _prefix);
            let thisMember = line.match(/this\./); // shows if we are looking for a member of this or not
            let thisMatch = line.match(/this/);

            let thisScope, topScope;

            let explore = (scope) => {

                // getting top scope
                if (!topScope && scope.file == editor.getPath() && scope.name == '{{global}}') {
                    topScope = scope;
                }

                // loading possible namespaces
                if (scope.vapi && scope.data && scope.data.type == 'namespace' && line.match(this.re.using) && scope.data.name.match(_prefix)) {
                    let name = scope.data.name;
                    let parent = scope;
                    while (parent.top) {
                        if (parent.top.data && parent.top.data.type == 'namespace') {
                            name = parent.top.data.name + '.' + name;
                        }
                        parent = parent.top;
                    }

                    haveSubNs = false;
                    scope.children.forEach((child) => {
                        if (!haveSubNs && child.data && child.data.type == 'namespace') haveSubNs = true;
                    });

                    let suggestion = {
                        text: name + (haveSubNs ? '' : ';'),
                        type: 'import',
                        displayText: name,
                        description: 'You should compile with the ' + scope.file.replace ('.vapi', '') + ' package.',
                        descriptionMoreURL: 'http://valadoc.org/#!api=' + scope.file.replace ('.vapi', '') + '/' + scope.data.name
                    };
                    suggestions.push(suggestion);
                }

                // list possible classes, when writing `new ...`
                if (newMatch) {
                    if (scope.data && scope.data.type == 'class' && scope.data.name.match(prefix)) {
                        let ctor = scope.data.name + ' ();';
                        scope.children.forEach((child) => {
                            if (child.data && child.data.type == 'method' && child.data.name == scope.data.name) {
                                ctor = child.data.name;
                                ctor += ' (';
                                let args = child.data.parameters.split(',');
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
                            if (scope.top.data && scope.top.data.type == 'namespace' && usings.includes(scope.data.type.name)) {
                                suggestions.unshift({
                                    text: ctor,
                                    displayText: scope.data.name,
                                    type: 'class',
                                    leftLabel: scope.top.data.name
                                });
                            } else if (scope.top.data) {
                                if (suggestions.length < 5) {
                                    suggestions.push({
                                        text: ctor,
                                        displayText: scope.data.name,
                                        type:'class',
                                        leftLabel: scope.top.data.type == 'namespace' ? scope.top.data.name : '',
                                        afterInsert: (editor) => {
                                            if (scope.top.data.type == 'namespace') {
                                                let rng = [[endUsing, 0], [endUsing, 0]];
                                                editor.setTextInBufferRange(rng, `using ${scope.top.data.name};\n`);
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

                if (scope.data && scope.data.type == 'method') {
                    possibleSymbols.push(scope);
                    // add method in ns to suggestions directly
                    if (scope.top.data && scope.top.data.type == 'namespace' && usings.includes(scope.top.data.name) && scope.data.name.match(_prefix)) {
                        let sugg = this.suggestMethod(scope);
                        suggestions.push(sugg);
                    }
                }

                if (scope.data && scope.data.type == 'property') {
                    possibleSymbols.push(scope);
                }

                if (scope.data && scope.data.type == 'field') {
                    if (scope.top.data && scope.top.data.type == 'namespace' && usings.includes(scope.top.data.name) && scope.data.name.match(_prefix) && !line.endsWith('.' + prefix)) {
                        suggestions.push({
                            text: scope.data.name,
                            leftLabel: '(static) ' + scope.data.valueType,
                            type: 'field'
                        });
                    }
                    // TODO: suggest properties or instance methods for fields and constants
                    // TODO: add fields to possibleSymbols
                }

                if (scope.data && scope.data.type == 'constant') {
                    if (scope.top.data && scope.top.data.type == 'namespace' && usings.includes(scope.top.data.name) && scope.data.name.match(_prefix) && !line.endsWith('.' + prefix)) {
                        suggestions.push({
                            text: scope.data.name,
                            leftLabel: scope.data.valueType,
                            type: 'constant'
                        });
                    }
                }

                if (scope.data && scope.data.type == 'signal') {
                    possibleSymbols.push(scope);
                }

                if (scope.file == editor.getPath() && scope.at[0][0] <= bufferPosition.row && scope.at[1][0] >= bufferPosition.row + 1) {
                    if (!thisScope && scope.name.match(this.re.isCls)) {
                        thisScope = scope;
                        topScope = scope;
                    }

                    // setting arguments as local variables
                    // do it in scopes.js ?
                    if (scope.data && scope.data.type == 'method') {
                        let args = scope.data.parameters;
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
                            if (expr == '') {
                                type = localVar.type;
                            } else {
                                type = this.getType(localVar.type, expr);
                            }
                            possibleSymbols.forEach((symbol) => {
                                if (symbol.top.data && symbol.top.data.type == 'class' && type && type != 'void' && symbol.top.data.name == type) {
                                    if (symbol.data && symbol.data.type == 'method') {
                                        let sugg = this.suggestMethod(symbol);
                                        if (sugg && (sugg.displayText.match(_prefix) || prefix == '.')) {
                                            suggestions.push(sugg);
                                        }
                                    } else if (symbol.data && symbol.data.type == 'signal' && (prefix == '.' || symbol.data.name.match(_prefix))) {
                                        suggestions.push({
                                            type: 'signal',
                                            text: scope.data.name,
                                            leftLabel: scope.data.returnType,
                                            iconHTML: '<i class="icon-zap"></i>'
                                        });
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

                        if (child.data && child.data.type == 'method' && thisMember) {
                            let sugg = this.suggestMethod(child);
                            if (sugg) {
                                suggestions.unshift(sugg);
                            }
                        } else if (child.data && child.data.type == 'property' && thisMember) {
                            let sugg = this.suggestProperty(child);
                            if (sugg) {
                                suggestions.unshift(sugg);
                            }
                        }
                    });
                }

                if (topScope) {
                    topScope.children.forEach((scope) => {
                        // if the scope is a method
                        if (scope.data && scope.data.type == 'method') {
                            // if we are in a class, don't do anything
                            if (!scope.top.name.match(this.re.isCls)) {
                                // don't take it if not matching the prefix
                                if (!scope.data.name.match(_prefix) || line.endsWith('.' + prefix)) return;

                                let sugg = this.suggestMethod(scope);
                                if (sugg) {
                                    suggestions.unshift(sugg);
                                }
                            } else if (scope.data.modifier == 'static') { // we can also show it if it's a static method, even if in a class

                                // don't take it if not matching the prefix
                                if (!scope.data.name.match(_prefix) || line.endsWith('.' + prefix)) return;

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

        if (!(scope.data && scope.data.type == 'method')) return;

        let isStatic = scope.data.modifier == 'static';

        let meth = scope.data.name + ' (';

        // generating html description for method parameters
        let args = scope.data.parameters.split(',');
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
            displayText: scope.data.name,
            leftLabel: ((scope.data.modifier == 'static') ? '(static) ' : '') + scope.data.returnType,
            rightLabelHTML: argDesc,
            type: 'method',
            description: scope.documentation.short
        };
    }

    suggestProperty (scope) {
        if (scope.data && scope.data.type == 'property') {
            return {
                text: scope.data.name,
                leftLabel: (scope.data.modifier == 'static' ? '(static) ' : '') + scope.data.valueType,
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
                if (scope.data && scope.data.type == 'class' && scope.data.name == type) {
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
                    if (child.data && child.data.type == 'method' && child.data.name == expr) {
                        let res = child.data.returnType.split('.');
                        return res[res.length - 1];
                    } else if (child.data && child.data.type == 'property' && child.data.name == expr) {
                        let res =  child.data.valueType.split('.');
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
