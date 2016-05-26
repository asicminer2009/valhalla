'use babel';

import * as fs from 'fs';
import ScopeManager from './scopes';

export default class ValaProvider {
    constructor() {
        const vapiDir = atom.config.get('super-vala.vapiDir');

        let manager = new ScopeManager();

        this.scopes = {
            file: 'parser.vala',
            children: [
                {
                    at: [[0, 0], [12, 0]],
                    name: 'public class Blob',
                    children: []
                },
                {
                    at: [[13, 0], [23, 0]],
                    name: 'public class Bulb',
                    children: [
                        {
                            at: [[14, 0], [18, 0]],
                            name: 'public Bulb (bool b)',
                            children: [
                                {
                                    at: [[15, 0], [17, 0]],
                                    name: 'if (b)',
                                    children: [],
                                    vars: [
                                        {
                                            name: 'truc',
                                            type: 'char'
                                        }
                                    ]
                                }
                            ],
                            vars: [
                                {
                                    name: 'test',
                                    type: 'int'
                                }
                            ]
                        }
                    ]
                }
            ]
        }

        // autocomplete-plus
        this.selector = '.source.vala';
        this.inclusionPriority = 1;
        this.excludeLowerPriority = true;

        // loading symbols from .vapi
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

    getSuggestions({editor, bufferPosition, scopeDescriptor, prefix, activatedManually}) {
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
            // if writing a new using directive
            if (line.match(/^using /)) {
                this.knownSymbols.forEach ((symbol) => {
                    // adding namespace suggestions only
                    if (symbol.type == 'namespace' && symbol.shortName.match(prefix)) {
                        var suggestion = {
                            text: symbol.shortName,
                            type: 'import',
                            leftLabel: symbol.name,
                            description: 'You should compile with the ' + symbol.file.replace ('.vapi', '') + ' package.',
                            descriptionMoreURL: 'http://valadoc.org/#!api=' + symbol.file.replace ('.vapi', '') + '/' + symbol.name
                        };
                        suggestions.push (suggestion);
                    }
                });
            } else {
                suggestions = suggestions.concat(this.suggest (this.knownSymbols, prefix, usings));
            }

            if ('this'.match (prefix)) {
                suggestions.unshift ({
                    text: 'this',
                    type: 'type'
                });
            }

            if (line.match('this.')) {
                //prefix = line.replace ('this.', '').replace ('\t', '');
                var currentThis;// = 'vMarkdown.Parser';
                fileSymbols.forEach ((symbol) => {
                    if (symbol.type == 'class') {
                        var currentLine = editor.getSelectedScreenRange().start.row;
                        if (symbol.start < currentLine && symbol.end > currentLine) {
                            currentThis = symbol.completeName;
                            console.log ('Current this :', currentThis);
                        }
                    }
                });
                suggestions = this.suggest (fileSymbols, prefix, usings);
            }

            // just keep the classes if we are creating a new instance
            if (line.match('new ')) {
                suggestions = suggestions.filter ((suggestion) => {
                    if (suggestion.type == 'class') {
                        return true;
                    } else {
                        return false;
                    }
                });
            }

            resolve(suggestions);
        });
    }

    suggest (symbols, prefix, usings, longPrefix) {
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
