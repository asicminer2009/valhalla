'use babel';

export default class ScopeManager {

    constructor() {
        this.re = {
            ns: /^namespace ([\w\.]+)( ?{)?$/,
            vapi: /\.vapi$/,
            docStart: /\/\*\*/,
            type: /(class|interface|struct|namespace)/, // namespace because they could contain methods, constants or fields
            taglet: /^@([^\s]*) (.*)/,
            method: /^(public |private |internal )?(static |virtual |override |abstract )?([\w\.]+) ([\w\.]+) \((.*)\)(throws ([\w\.,])+)?( ?{|;)?$/,
            localVar: /(const )?([\w]+(<(.+)>)?) (\w+) ?= ?(.+);/,
            notCond: /(!|=)/,
            foreach: /foreach ?\((\w+) (\w+) in (.+)\)/,
            nullVar: /(\w+) (\w+);/,
            signal: /^(public |private )?(static )?(virtual |override )?signal ([\w\.]+) ([\w\.]+) ?\((.*)\);$/,
            klass: /^(public |private |internal )?(abstract )?class ([\w\.]+)( :( [\w\.,]+)+)?( ?{)?$/,
            prop: /^(public |private |protected )?(static |abstract |override |virtual )?((?!(namespace|class|interface|struct))[\w\.]+) ([\w]+)( ?{)?$/,
            fieldOrConst: /^(public |private )?(static )?(const )?([\w\.]+) ([\w\.]+)( ?= ?.*)?;$/,
            signal: /^(public |private )?(static )?(virtual |override )?signal ([\w\.]+) ([\w\.]+) ?\((.*)\);$/,
            attribute: /\[(?!\d).+?\]/g,
            compilation: {
                if: /#if (.+)/,
                else: /#else/,
                endif: /#endif/
            }
        };
        this.scopes = [];
    }

    parse(code, path) {
        let isVapi = (path.match(this.re.vapi) != undefined);
        code += '\n';
        let openC = 0, endC = 0;
        let mainScope = {
            name: '{{global}}',
            at: [[0, 0], [code.split('\n').length, 0]],
            children: [],
            vars: [],
            file: path,
            vapi: isVapi,
            documentation: {},
            data: {}
        }
        let index = this.scopes.findIndex((scope) => { return scope.file == path; });
        index = index >= 0 ? index : this.scopes.length;
        this.scopes[index] = mainScope;
        let currentScope = mainScope;
        lineNum = 1;

        let ignoredChars = ['\t', '\n', '"'];

        let token = '';
        let canMatch = true, mlComm = false;
        let docComment = false, doc = '';
        let inIf = false, ifIsTrue;
        let i = -1;
        for (let ch of code) {

            i++;

            // at the end of a line, we look for compilation symbols
            if (ch == '\n') {
                let ifMatch = token.match(this.re.compilation.if);
                if (ifMatch) {
                    inIf = true;
                    if (ifMatch[1].startsWith('GLIB')) {
                        let glibVer = atom.config.get('valhalla.glibVersion');
                        ifMatch[1].split('_').forEach((part, i) => {
                            if (part == 'GLIB') return;
                            if (new Number(part) >= new Number(glibVer.split('.')[i - 2])) ifIsTrue = true;
                        });
                    }
                    token = '';
                    continue;
                }

                let elseMatch = token.match(this.re.compilation.else);
                if (elseMatch) {
                    ifIsTrue = !ifIsTrue;
                    token = '';
                    continue;
                }

                let endIfMatch = token.match(this.re.compilation.endif);
                if (endIfMatch) {
                    inIf = false;
                    ifIsTrue = null;
                    token = '';
                    continue;
                }

                if (inIf && !ifIsTrue) {
                    continue;
                }

                if (!canMatch && !mlComm) {
                    canMatch = true;
                }

                lineNum++;
            }

            // ignore literals and comments
            if (ch == '"') canMatch = !canMatch;
            if (ch == '*') {
                if (code[i - 1] == '*' && code[i - 2] == '/') {
                    token = token.substr(0, token.length - 2);
                    docComment = true;
                } else if (code[i - 1] == '/') {
                    token = token.substr(0, token.length - 1);
                    canMatch = false;
                    mlComm = true;
                    continue;
                }
            }
            if (ch == '/' && code[i - 1] == '*') {
                canMatch = true;
                docComment = false;
                mlComm = false;
                continue;
            }

            if (ch == '/' && code[i + 1] == '/') {
                canMatch = false;
                mlComm = false;
            }

            // we skip new lines, indentations comments and literals
            if (!(ignoredChars.includes(ch) || !canMatch || (ch == ' ' && code[i + 1] == ' '))) {
                if (docComment) {
                    doc += ch;
                    continue; // don't parse things that are in doc
                }

                token += ch;

                if (ch == '{') {

                    let parsedDoc = this.parseDoc (doc);
                    doc = '';
                    token = token.replace(this.re.attribute, '');

                    // scope creation
                    let newScope = {
                        top: currentScope,
                        at: [[lineNum, 0]],
                        name: token.trim(),
                        children: [],
                        vars: [],
                        file: path,
                        documentation: parsedDoc,
                        vapi: isVapi,
                        data: {}
                    };
                    currentScope.children.push(newScope);
                    currentScope = newScope;

                    token = '';

                    if (nsMatch = currentScope.name.match(this.re.ns)) {
                        currentScope.data = {
                            type: 'namespace',
                            name: nsMatch[1]
                        };
                        continue;
                    }

                    if (klassMatch = currentScope.name.match(this.re.klass)) {
                        currentScope.data = {
                            type: 'class',
                            name: klassMatch[3],
                            access: klassMatch[1] ? klassMatch[1].trim() : 'public', // TODO: check if default visibility os really public
                            modifier: klassMatch[2] ? klassMatch[2].trim() : null,
                            inherits: klassMatch[4] ? klassMatch[4].replace(' : ', '') : null
                        }
                        continue;
                    }

                    if (methMatch = currentScope.name.match(this.re.method)) {
                        currentScope.data = {
                            type: 'method',
                            returnType: methMatch[3],
                            name: methMatch[4],
                            access: methMatch[1] ? methMatch[1].trim() : 'private',
                            modifier: methMatch[2] ? methMatch[2].trim() : null,
                            parameters: methMatch[5], // TODO: parse them
                            throws: methMatch[6]
                        };
                        continue;
                    }

                    if (propMatch = currentScope.name.match(this.re.prop)) {
                        currentScope.data = {
                            type: 'property',
                            name: propMatch[5],
                            valueType: propMatch[3],
                            access: propMatch[1] ? propMatch[1].trim() : 'private',
                            modifier: propMatch[2] ? propMatch[2].trim() : null
                        };
                        continue;
                    }

                    // foc = Filed Or Constant
                    if ((focMatch = currentScope.name.match(this.re.fieldOrConst)) && currentScope.top.data && (
                        currentScope.top.data.type == 'namespace' ||
                        currentScope.top.data.type == 'class' ||
                        currentScope.top.data.type == 'interface' ||
                        currentScope.top.data.type == 'struct'
                    )) {
                        currentScope.data = {
                            type: focMatch[3] ? 'constant' : 'field',
                            name: focMatch[5],
                            valueType: focMatch[4],
                            modifier: focMatch[2] ? focMatch[2].trim() : null,
                            access: focMatch[1] ? focMatch[1].trim() : 'private'
                        };
                        continue;
                    }

                    // detect foreach and add variables if needed
                    let feMatch = currentScope.name.match(this.re.foreach);
                    if (feMatch) {
                        currentScope.vars.push({
                            name: feMatch[2],
                            type: feMatch[1],
                            isConst: false,
                            initialValue: '?',
                            line: lineNum
                        });
                        continue;
                    }
                }

                if (ch == '}') {
                    currentScope.at[1] = [lineNum, i + 1];
                    if (currentScope.top) {
                        currentScope = currentScope.top;
                    }

                    token = '';
                }

                if (ch == ';') {

                    if (signalMatch = token.trim().match(this.re.signal)) {
                        currentScope.children.push ({
                            top: currentScope,
                            at: [[lineNum, 0], [lineNum, token.length]],
                            name: token.replace(';', ' {').trim(),
                            children: [],
                            vars: [],
                            file: path,
                            documentation: {},
                            vapi: isVapi,
                            data: {
                                type: 'signal',
                                name: signalMatch[5],
                                returnType: signalMatch[4],
                                access: signalMatch[1] ? signalMatch[1].trim() : 'private',
                                modifier: signalMatch[2] ? signalMatch[2].trim() : null,
                                parameters: signalMatch[6] // TODO: parse them
                            }
                        });
                    }

                    // it could be a method, if we are in a .vapi file or in an interface for instance
                    let methodMatch = token.trim().match(this.re.method);
                    if (methodMatch) {
                        currentScope.children.push({
                            top: currentScope,
                            at: [[lineNum, 0], [lineNum, token.length]],
                            name: token.replace(';', ' {').trim(),
                            children: [],
                            vars: [],
                            file: path,
                            documentation: {},
                            vapi: isVapi,
                            data: {
                                type: 'method',
                                returnType: methodMatch[3],
                                name: methodMatch[4],
                                access: methodMatch[1] ? methodMatch[1].trim() : 'private',
                                modifier: methodMatch[2] ? methodMatch[2].trim() : null,
                                parameters: methodMatch[5], // TODO: parse them
                                throws: methodMatch[6]
                            }
                        })
                    }

                    // it could also be a static field or constant
                    let fieldMatch = token.match(this.re.fieldOrConst);
                    if (fieldMatch) {
                        currentScope.children.push({
                            top: currentScope,
                            at: [[lineNum, 0], [lineNum, token.length]],
                            name: token.trim(),
                            children: [],
                            vars: [],
                            file: path,
                            documentation: {},
                            vapi: isVapi
                        });
                    }

                    // or a signal
                    let signalMatch = token.match(this.re.signal);
                    if (signalMatch) {
                        currentScope.children.push({
                            top: currentScope,
                            at: [[lineNum, 0], [lineNum, token.length]],
                            name: token.trim(),
                            children: [],
                            vars: [],
                            file: path,
                            documentation: {},
                            vapi: isVapi
                        });
                    }

                    let match = token.match(this.re.localVar);
                    if (match) {
                        currentScope.vars.push({
                            name: match[5],
                            type: match[2],
                            isConst: (match[1] ? true : false),
                            initialValue: match[6],
                            line: lineNum
                        });
                    }

                    let nvMatch = token.match(this.re.nullVar);
                    if (nvMatch && nvMatch[1] != 'using') {
                        currentScope.vars.push({
                            name: nvMatch[2],
                            type: nvMatch[1],
                            isConst: false,
                            initialValue: 'null',
                            line: lineNum
                        });
                    }

                    token = '';
                }
            }
        }
    }

    parseDoc (doc) {
        // doc parsing
        let firstLine = true;
        let parsedDoc = {};
        doc = doc.replace(this.re.docStart, '');
        doc.split('*').forEach((docLine) => {
            // for each line ...
            docLine = docLine.trim();
            if (firstLine && docLine && docLine != '') {
                // if we are on the first line, we set short description
                parsedDoc.short = docLine;
                firstLine = false;
            } else if (docLine && docLine != '') {
                // else, we try to find taglets
                let tagletMatch = docLine.match(this.re.taglet);
                if (tagletMatch) {
                    let taglet = tagletMatch[1];
                    let data = tagletMatch[2];
                    if (!parsedDoc[taglet]) {
                        parsedDoc[taglet] = [];
                    }
                    parsedDoc[taglet].push(data);
                } else {
                    // if there are no taglets, this line is a part of the long description
                    if(!parsedDoc.long) parsedDoc.long = '';
                    parsedDoc.long += docLine + '\n';
                }
            } else if (docLine == '' && !firstLine) {
                // if we are in the long description, and the line is empty, it's a linebreak in fact
                if(!parsedDoc.long) parsedDoc.long = '';
                parsedDoc.long += '\n';
            }
        });
        return parsedDoc;
    }

}
