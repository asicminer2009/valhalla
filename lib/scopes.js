'use babel';

export default class ScopeManager {

    constructor() {
        this.re = {
            vapi: /\.vapi$/,
            docStart: /\/\*\*/,
            type: /(class|interface|struct)/,
            taglet: /^@([^\s]*) (.*)/,
            method: /(public |private |internal )?(static )?(\w+) (\w+) ?\((.*)\);/,
            localVar: /(const )?([\w]+(<(.+)>)?) (\w+) ?= ?(.+);/,
            notCond: /(!|=)/,
            foreach: /foreach ?\((\w+) (\w+) in (.+)\)/,
            nullVar: /(\w+) (\w+);/
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
            instructions: [],
            file: path,
            vapi: isVapi,
            documentation: {}
        }
        let i = this.scopes.findIndex((scope) => { return scope.file == path; });
        i = i >= 0 ? i : this.scopes.length;
        this.scopes[i] = mainScope;
        let currentScope = mainScope;
        lineNum = 1;

        let line = '';
        let canMatch = true;
        let docComment = false, doc = '';
        for (let ch of code) {
            if (ch == '\n') {

                line = line.trimLeft();
                let varDec = false;
                let token = '';
                let lineSoFar = '';
                for (let i in line) {
                    i = new Number(i);
                    let char = line[i];
                    token += char;

                    if (char == '/' && line[i + 1] == '*' && line[i + 2] == '*') {
                        canMatch = false;
                        docComment = true;
                    }

                    if (char == '*' && line[i + 1] == '/' && docComment) {
                        docComment = false;
                        canMatch = true;
                    }

                    if (docComment) {
                        doc += char;
                    }

                    if (char == '"') {
                        canMatch = !canMatch;
                    }

                    if (char == ';' && canMatch) {
                        if (isVapi && currentScope.top && currentScope.name.match(this.re.type)) {
                            // it could be a method, if we are in a .vapi file
                            let methodMatch = token.match(this.re.method);
                            if (methodMatch) {
                                let methodName = methodMatch[4];
                                currentScope.children.push({
                                    top: currentScope,
                                    at: [[lineNum, 0], [lineNum, token.length]],
                                    name: token.replace(';', '{ '),
                                    children: [],
                                    vars: [],
                                    instructions: [],
                                    file: path,
                                    documentation: {},
                                    vapi: isVapi
                                })
                            }

                        } else {
                            token = '';
                        }
                    }

                    if (char == '{' && canMatch) {
                        // doc parsing
                        let firstLine = true;
                        let parsedDoc = {};
                        doc = doc.replace(this.re.docStart, '');
                        doc.split('*').forEach((docLine) => {
                            docLine = docLine.trim();
                            if (firstLine && docLine && docLine != '') {
                                parsedDoc.short = docLine;
                                firstLine = false;
                            } else if (docLine && docLine != '') {
                                let tagletMatch = docLine.match(this.re.taglet);
                                if (tagletMatch) {
                                    let taglet = tagletMatch[1];
                                    let data = tagletMatch[2];
                                    if (!parsedDoc[taglet]) {
                                        parsedDoc[taglet] = [];
                                    }
                                    parsedDoc[taglet].push(data);
                                } else {
                                    if(!parsedDoc.long) parsedDoc.long = '';
                                    parsedDoc.long += docLine + '\n';
                                }
                            } else if (docLine == '' && !firstLine) {
                                if(!parsedDoc.long) parsedDoc.long = '';
                                parsedDoc.long += '\n';
                            }
                        });
                        doc = '';

                        // scope creation
                        let newScope = {
                            top: currentScope,
                            at: [[lineNum, 0]],
                            name: token,
                            children: [],
                            vars: [],
                            file: path,
                            documentation: parsedDoc,
                            vapi: isVapi
                        };
                        currentScope.children.push(newScope);
                        currentScope = newScope;
                        openC++;
                        token = '';
                    }

                    if (char == '}' && canMatch) {
                        currentScope.at[1] = [lineNum, i + 1];
                        if (currentScope.top) {
                            currentScope = currentScope.top;
                        }
                        endC++;
                    }

                    if (char == '=' && i < line.length - 1 && !(line[i + 1].match(this.re.notCond) || line[i - 1].match(this.re.notCond))) {
                        varDec = true;
                    }
                }

                if (varDec) {

                    let match = line.match(this.re.localVar);
                    if (match) {
                        currentScope.vars.push({
                            name: match[5],
                            type: match[2],
                            isConst: (match[1] ? true : false),
                            initialValue: match[6],
                            line: lineNum
                        });
                    }

                    varDec = false;
                }

                let feMatch = currentScope.name.match(this.re.foreach);
                if (feMatch) {
                    currentScope.vars.push({
                        name: feMatch[2],
                        type: feMatch[1],
                        isConst: false,
                        initialValue: '?',
                        line: lineNum
                    });
                }

                let nvMatch = line.match(this.re.nullVar);
                if (nvMatch) {
                    currentScope.vars.push({
                        name: nvMatch[2],
                        type: nvMatch[1],
                        isConst: false,
                        initialValue: 'null',
                        line: lineNum
                    });
                }

                line = '';
                lineNum++;
            } else {
                line += ch;
            }
        }
    }
}
