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

        if (serializedState && serializedState.knownSymbols) {
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
                    if (file.endsWith ('.vapi')) {
                        fs.readFile (vapiDir + file, 'utf-8', (err, content) => {
                            if (err) {
                                console.log (err);
                                return;
                            }
                            this.knownSymbols = this.knownSymbols.concat(this.loadSymbols (content, file));
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
        var line = editor.getTextInRange([[bufferPosition.row, 0], bufferPosition]);
        var fileSymbols = this.loadSymbols(editor.getText (), editor.getTitle());
        var usings = ['GLib'];
        editor.getText().split('\n').forEach((line) => {
            usings.concat (fileSymbols.filter((symbol) => {
                return symbol.type == 'namespace';
            }));
            var usingRe = /^using (.*);/;
            var usingMatch = line.match (usingRe);
            if (usingMatch) {
                usings.push(usingMatch[1]);
            }
        });


        return new Promise ((resolve) => {
            var suggestions = [];
            var possibleSymbols = []; // possible symbols for local variables


            // just take the good symbols in all those we loaded from .vapi
            this.knownSymbols.forEach((symbol) => {

                // for using directives, only take matching namespaces
                if (symbol.type == 'namespace' && line.match(/^using /) && symbol.shortName.match(prefix)) {
                    let suggestion = {
                        text: symbol.shortName,
                        type: 'import',
                        leftLabel: symbol.name,
                        description: 'You should compile with the ' + symbol.file.replace ('.vapi', '') + ' package.',
                        descriptionMoreURL: 'http://valadoc.org/#!api=' + symbol.file.replace ('.vapi', '') + '/' + symbol.name
                    };
                    suggestions.unshift (suggestion);
                }

                let newMatch = line.match(/new (.*)$/);
                if (newMatch && newMatch[1] == prefix && symbol.shortName.match(prefix)) {
                    let suggestion = {
                        text: symbol.shortName,
                        type: 'class',
                        leftLabel: symbol.name
                    };
                    suggestions.unshift(suggestion);
                }

                if ((symbol.type == 'property' || symbol.type == 'method') && symbol.shortName.match(prefix)) {
                    possibleSymbols.push(symbol);
                }

            });

            // local variables

            let thisMember = line.match(/this\./);
            //if (thisMember) suggestions = [];

            // get scopes at the cursor
            let scopeMatch = [];
            let thisScope;
            let exploreScope = (scope) => {
                if (scope.at[0][0] <= bufferPosition.row && scope.at[1][0] >= bufferPosition.row + 1) {
                    if (!thisScope && scope.name.match(/ ?class /)) thisScope = scope;

                    scopeMatch.push(scope);
                    return scope.children.forEach((child) => exploreScope(child));
                }
            };

            exploreScope(this.manager.scopes[0]);
            console.log(scopeMatch);

            if (thisScope) {
                console.log(thisScope);
                thisScope.children.forEach((scope) => {
                    let memberMatch = scope.name.match(/(public|private|internal) (\w+) (.+)/);
                    if (memberMatch) console.log(memberMatch);
                    if (memberMatch && thisMember && memberMatch[2] != 'class' && memberMatch[2] != 'interface') {
                        let type = memberMatch[2];
                        let def = memberMatch[3];
                        if (def.match(prefix)) {
                            if (def.match(/\(.*\)/)) {
                                let sugg = this.suggestMethod(scope);
                                if (sugg) {
                                    suggestions.unshift(sugg);
                                }
                            } else {
                                let propName = def.split('{')[0].trim();
                                suggestions.push({
                                    text: propName,
                                    leftLabel: type,
                                    type: 'property',
                                    description: scope.documentation.short
                                });
                            }
                        }


                        //if ()
                    }
                });
            } else {
                // shows an error if we are typing `this` when not in a class
                let thisMatch = line.match(/this/);
                if (thisMatch) {
                    let range = [[bufferPosition.row, thisMatch.index], [bufferPosition.row, thisMatch.index + 4]];
                    console.log(range);
                    let marker = editor.markBufferRange(range);
                    let div = document.createElement('div');
                    div.textContent = 'this isn\'t valid here.'
                    div.style.padding = '10px';
                    console.log(div);

                    editor.decorateMarker(marker, {
                        type: 'overlay',
                        class: 'invalid',
                        item: div
                    });

                    window.setTimeout(() => {
                        marker.destroy();
                    }, 5000)
                }
            }

            // show possible local variables
            scopeMatch.forEach((scope) => {
                if (scope.vars.length > 0) {
                    scope.vars.forEach((localVar) => {

                        if (line.trim().match(localVar.name + '.')) {
                            console.log('found obj prop', localVar.name);
                            possibleSymbols.filter((symbol) => {
                                return symbol.name.match(localVar.type + '.' + prefix);
                            }).forEach((symbol) => suggestions.unshift({
                                text: symbol.shortName,
                                type: symbol.type,
                                leftLabel: symbol.valueType
                            }));
                        }

                        let _prefix = prefix.replace(/\./, '\\.');
                        if (localVar.name.match(_prefix)) {
                            console.log('found local var', localVar.name);
                            let sugg = {
                                text: localVar.name,
                                type: 'variable',
                                leftLabel: localVar.type
                            };
                            suggestions.unshift(sugg);
                        }
                    });
                }
            });

            let topScope = thisScope ? thisScope : this.manager.scopes[0];
            topScope.children.forEach((scope) => {
                // if the scope is a method
                let methodMatch = scope.name.match(/(public |private |internal )?(static )?(\w+) (\w+) ?\((.*)\)( {)?/);
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

    suggests (symbols, prefix, usings, longPrefix) {
        var suggestions = [];
        const maxSuggestions = 20;
        symbols.forEach ((symbol) => {
            // if symbol contains prefix and we havn't got all our suggestions
            if (symbol.shortName.match(prefix) && suggestions.length <= maxSuggestions) {
                // if there is already the include directive
                if (usings.includes(symbol.namespace)) {
                    var description;
                    if (symbol.type == 'method') {
                        description = 'Returns : ' + symbol.valueType;
                    }
                    var suggestion = {
                        text: symbol.shortName,
                        type: symbol.type,
                        leftLabel: symbol.name,
                        description: description,
                        descriptionMoreURL: 'http://valadoc.org/#!api=' + symbol.file.replace ('.vapi', '') + '/' + symbol.name
                    };
                    suggestions.unshift (suggestion);
                } else {
                    var description;
                    if (symbol.type == 'method') {
                        description = 'Returns : ' + symbol.valueType;
                    } else {
                        description = 'You should add : using ' + symbol.namespace + ', in this file.';
                    }
                    var suggestion = {
                        text: symbol.shortName,
                        type: symbol.type,
                        leftLabel: symbol.name,
                        description: description,
                        descriptionMoreURL: 'http://valadoc.org/#!api=' + symbol.file.replace ('.vapi', '') + '/' + symbol.name
                    };
                    suggestions.push (suggestion);
                    // TODO : ajouter les usings qui vont bien automatiquement
                }

            }
        });
        return suggestions;
    }

    loadSymbols(vala, file) {
        var res = [];
        if (!vala) {
            return;
        }

        var nsLevel = 0;
        var lastCls = 0;

        var inNs = false,
            inClass = false,
            inEnum = false
            inStruct = false;

        var ns = '',
            cls = '',
            enm = ''
            struct = '';

        var nsRe = /namespace (.*) {/,
            clsRe = /public class (.*) (: (.*))?{/,
            enmRe = /public enum (.*) {/
            structRe = /public struct (.*) {/;

        var propRe = /(public|private|internal) (.*) (.*) {.*}/,
            methodRe = /(public|private|internal) (?!delegate )(?!signal )(.*) (.*) \((.*)\)/,
            signalRe = /(public|private|internal) signal (.*) (.*) \((.*)\)/,
            delegateRe = /(public|private|internal) delegate (.*) (.*) \((.*)\)/;

        var lineNum = 0;
        vala.split('\n').forEach((line, arr, index) => {
            line = line.replace ('\t', '');

            var nsMatch = line.match (nsRe)
            if (nsMatch) {
                if (inNs) {
                    var i = 0, parentNs;
                    ns.split('.').forEach((part) => {
                        if (i <= nsLevel) {
                            if (parentNs) {
                                parentNs += '.' + part;
                            } else {
                                parentNs = part;
                            }
                        }
                        i++;
                    });
                    nsLevel++;
                    ns = parentNs + '.' + nsMatch[1];
                } else {
                    nsLevel++;
                    ns = nsMatch[1];
                    inNs = true;
                }

                res.push({
                    type: 'namespace',
                    name: ns,
                    shortName : ns,
                    file: file
                });
            }

            var clsMatch = line.match (clsRe);
            if (clsMatch) {
                cls = clsMatch[1];
                if (cls.match (' ')) {
                    cls = cls.split (' ')[0];
                }
                inClass = true;

                lastCls = res.push({
                    type: 'class',
                    name: ns + '.' + cls,
                    shortName : cls,
                    namespace: ns,
                    start: lineNum,
                    file: file
                });
            }

            var structMatch = line.match (structRe);
            if (structMatch) {
                struct = structMatch[1];
                inStruct = true;

                res.push({
                    type: 'struct',
                    name: ns + '.' + struct,
                    shortName : struct,
                    namespace: ns,
                    file: file
                });
            }

            var enmMatch = line.match (enmRe);
            if (enmMatch) {
                inEnum = true;
            }

            var propMatch = line.match(propRe);
            if (propMatch) {
                var prefix = '';
                if (inNs) {
                    prefix += ns;
                }
                if (inClass) {
                    if (prefix) {
                        prefix += '.' + cls;
                    } else {
                        prefix = cls;
                    }
                }
                var visibility = propMatch[1];
                var type = propMatch[2];
                var propName = propMatch[3];

                var completeName = '';
                if (prefix != '') {
                    completeName = prefix + '.' + propName;
                } else {
                    completeName = propName;
                }

                if (visibility == 'public') {
                    res.push({
                        type: 'property',
                        name: completeName,
                        shortName: propName,
                        valueType: type,
                        namespace: ns,
                        file: file
                    });
                }
            }

            var methodMatch = line.match (methodRe);
            if (methodMatch) {
                var prefix = '';
                if (inNs) {
                    prefix += ns;
                }
                if (inClass) {
                    if (prefix != '') {
                        prefix += '.' + cls;
                    } else {
                        prefix = cls;
                    }
                }
                var visibility = methodMatch[1];
                var type = methodMatch[2];
                var methodName = methodMatch[3];

                var completeName = '';
                if (prefix != '') {
                    completeName = prefix + '.' + methodName;
                } else {
                    completeName = methodName;
                }

                if (visibility == 'public') {
                    res.push({
                        type: 'method',
                        name: completeName,
                        shortName: methodName,
                        valueType: type,
                        namespace: ns,
                        file: file
                    });
                }
            }

            var signalMatch = line.match (signalRe);
            if (signalMatch) {
                var prefix = '';
                if (inNs) {
                    prefix += ns;
                }
                if (inClass) {
                    if (prefix != '') {
                        prefix += '.' + cls;
                    } else {
                        prefix = cls;
                    }
                }
                var visibility = signalMatch[1];
                var type = signalMatch[2];
                var signalName = signalMatch[3];

                var completeName = '';
                if (prefix != '') {
                    completeName = prefix + '.' + signalName;
                } else {
                    completeName = signalName;
                }

                if (visibility == 'public') {
                    res.push({
                        type: 'type',
                        name: completeName,
                        shortName: signalName,
                        valueType: type,
                        namespace: ns,
                        file: file
                    });
                }
            }

            var delegateMatch = line.match (delegateRe);
            if (delegateMatch) {
                var prefix = '';
                if (inNs) {
                    prefix += ns;
                }
                if (inClass) {
                    if (prefix != '') {
                        prefix += '.' + cls;
                    } else {
                        prefix = cls;
                    }
                }
                var visibility = delegateMatch[1];
                var type = delegateMatch[2];
                var delegateName = delegateMatch[3];

                var completeName = '';
                if (prefix != '') {
                    completeName = prefix + '.' + delegateName;
                } else {
                    completeName = delegateName;
                }

                if (visibility == 'public') {
                    res.push({
                        type: 'type',
                        name: completeName,
                        shortName: delegateName,
                        valueType: type,
                        namespace: ns,
                        file: file
                    });
                }
            }

            // closing symbols
            if (line.match (/^}$/)) {
                if (inEnum) {
                    inEnum = false;
                } else if (inClass) {
                    inClass = false;
                    res[lastCls - 1].end = lineNum;
                } else if (inStruct) {
                    inStruct = false;
                } else if (inNs) {
                    nsLevel--;
                    if (nsLevel == 0) {
                        inNs = false;
                    }
                }
            }
            lineNum++;
        });
        return res;
    }
}
