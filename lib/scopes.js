'use babel';

export default class ScopeManager {

    constructor() {
        this.scopes = [];
    }

    parse(code, path) {
        let isVapi = (path.match(/\.vapi$/) != undefined);
        code += '\n';
        let openC = 0, endC = 0;
        let mainScope = {
            name: '{{global}}',
            at: [[0, 0], [code.split('\n').length, 0]],
            children: [],
            vars: [],
            instructions: [],
            file: path,
            vapi: isVapi
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
                        if (isVapi && currentScope.top && currentScope.name.match(/(class|interface)/)) {
                            // it could be a method, if we are in a .vapi file
                            let methodMatch = token.match(/(public |private |internal )?(static )?(\w+) (\w+) ?\((.*)\);/);
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
                            //currentScope.instructions.push(token);
                            token = '';
                        }
                    }

                    if (char == '{' && canMatch) {
                        // doc parsing
                        let firstLine = true;
                        let parsedDoc = {};
                        doc = doc.replace(/\/\*\*/, '');
                        doc.split('*').forEach((docLine) => {
                            docLine = docLine.trim();
                            if (firstLine && docLine && docLine != '') {
                                parsedDoc.short = docLine;
                                firstLine = false;
                            } else if (docLine && docLine != '') {
                                let tagletMatch = docLine.match(/^@([^\s]*) (.*)/);
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
                            instructions: [],
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
                        console.log(`closing '${currentScope.name.trim()}'`);
                        currentScope.at[1] = [lineNum, i + 1];
                        if (currentScope.top) {
                            currentScope = currentScope.top;
                        }
                        endC++;
                    }

                    if (char == '=' && i < line.length - 1 && !(line[i + 1].match(/(!|=)/) || line[i - 1].match(/(!|=)/))) {
                        varDec = true;
                    }
                }

                if (varDec) {

                    let match = line.match(/(.*) ?= ?.*;/);
                    if (match) {
                        let varDef = match[0].trim().split(' ');

                        // TODO: Support `var` keyword for implicit types
                        // TODO: Support constants

                        currentScope.vars.push({
                            name: varDef[1],
                            type: varDef[0]
                        });
                    }

                    varDec = false;
                }
/*
                let methodMatch = line.match(/([\w_]+)\s([\w_]+)\s*\((.*)\)/);
                if (methodMatch) {
                    console.log(`found method : ${methodMatch[0]}`)
                    let args = methodMatch[3].split(',');
                    args.forEach((arg) => {
                        let argDef = arg.split(' ');
                        console.log(argDef);
                        currentScope.vars.push({
                            name: argDef[1],
                            type: argDef[0]
                        });
                    })
                }*/

                line = '';
                lineNum++;
            } else {
                line += ch;
            }
        }
    }
}
