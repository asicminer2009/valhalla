'use babel';

export default class ScopeManager {

    constructor() {

    }

    parse(code) {
        let openC = 0, endC = 0;
        let mainScope = {
            at: [[0, 0], [code.split('\n').length, 0]],
            children: [],
            vars: []
        }
        this.scopes = [mainScope];
        let currentScope = this.scopes[0];
        lineNum = 1;

        line = '';
        canMatch = true;
        for (let ch of code) {
            if (ch == '\n') {

                let varDec = false;
                let token = '';
                for (let i in line) {
                    i = new Number(i);
                    let char = line[i];
                    token += char;

                    if (char == '"') {
                        canMatch = !canMatch;
                    }

                    if (char == '{' && canMatch) {
                        let newScope = {
                            top: currentScope,
                            at: [[lineNum, 0]],
                            name: token,
                            children: [],
                            vars: []
                        };
                        currentScope.children.push(newScope);
                        currentScope = newScope;
                        openC++;
                        token = '';
                    }

                    if (char == '}' && canMatch) {
                        currentScope.at[1] = [lineNum, 0];
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
