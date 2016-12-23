'use babel';

export default class ScopeManager {

    constructor() {
        // TODO : there is two times `signal`
        this.re = {
            ns: /^namespace ([\w\.]+)( ?{)?$/,
            vapi: /\.vapi$/,
            docStart: /\/\*\*/,
            type: /(class|interface|struct|namespace)/, // namespace because they could contain methods, constants or fields
            taglet: /^@([^\s]*) (.*)/,
            method: /^(public |private |internal )?(static |virtual |override |abstract )?(unowned )?([\w\.\*<>\[\] ]+) ([\w\.@]+) ?\((.*)\)(throws ([\w\.,])+)?( ?{|;)?$/,
            localVar: /(const )?([\w]+(<(.+)>)?) (\w+) ?= ?(.+);/,
            notCond: /(!|=)/,
            foreach: /foreach ?\((\w+) (\w+) in (.+)\)/,
            nullVar: /(\w+) (\w+);/,
            signal: /^(public |private )?(static )?(virtual |override )?signal ([\w\.]+) ([\w\.]+) ?\((.*)\);$/,
            klass: /^(public |private |internal )?(abstract )?class ([\w\.]+(<[^:]*?>)?)( : .*?)?( ?{)?$/,
            iface: /^(public |private |internal)?interface ([\w\.<>]+)( :( [\w\.,]+)+)?( ?{)?$/,
            struct: /^(public |private |internal)?struct ([\w\.]+)( : [\w\.]+)?( ?{)?$/,
            prop: /^(public |private |protected )?(static |abstract |override |virtual )?(unowned )?((?!(namespace|class|interface|struct))[\w\.\*<>\[\] ]+) ([\w@]+)( ?{)?$/,
            fieldOrConst: /^(public |private )?(static )?(const )?([\w\.<>\[\]]+) ([\w\.]+)( ?= ?.*)?;$/,
            signal: /^(public |private )?(static )?(virtual |override )?signal ([\w\.<>\[\]]+) ([\w\.]+) ?\((.*)\);$/,
            attributes: /^\[(.*)\]$/,
            attribute: /(\w+) ?\((.*)\)/,
            enumeration: /^(public |private |protected )?enum ([\w\.]+) ?{$/,
            compilation: {
                if: /#if (.+)/,
                else: /#else/,
                endif: /#endif/
            }
        };
        this.scopes = [];
    }

    parse(code, path) {
        let isVapi =(path.match(this.re.vapi) != undefined);
        code += '\n';
        let openC = 0, endC = 0;
        let mainScope = {
            name: '{{global}}',
            data: {
                type: 'global'
            },
            at: [[0, 0], [code.split('\n').length, 0]],
            children: [],
            vars: [],
            file: path,
            vapi: isVapi,
            documentation: {},
        }
        let index = this.scopes.findIndex((scope) => { return scope.file === path; });
        index = index >= 0 ? index : this.scopes.length;
        this.scopes[index] = mainScope;
        let currentScope = mainScope;
        lineNum = 1;

        let ignoredChars = ['\t', '\n', '"'];

        let token = '';
        let canMatch = true, mlComm = false, inAttr = false;
        let docComment = false, doc = '';
        let attributes = [];
        let inIf = false, ifIsTrue;
        let i = -1;
        for(let ch of code) {

            i++;

            // at the end of a line, we look for compilation symbols
            // and enums values
            if(ch === '\n') {
                let ifMatch = token.match(this.re.compilation.if);
                if(ifMatch) {
                    inIf = true;
                    if(ifMatch[1].startsWith('GLIB')) {
                        let glibVer = atom.config.get('valhalla.glibVersion');
                        let i = 0;
                        for(part of ifMatch[1].split('_')) {
                            if(part === 'GLIB') return;
                            if(new Number(part) >= new Number(glibVer.split('.')[i - 2])) ifIsTrue = true;
                            i++;
                        }
                    }
                    token = '';
                    continue;
                }

                let elseMatch = token.match(this.re.compilation.else);
                if(elseMatch) {
                    ifIsTrue = !ifIsTrue;
                    token = '';
                    continue;
                }

                let endIfMatch = token.match(this.re.compilation.endif);
                if(endIfMatch) {
                    inIf = false;
                    ifIsTrue = null;
                    token = '';
                    continue;
                }

                if(inIf && !ifIsTrue) {
                    continue;
                }

                if(!canMatch && !mlComm) {
                    canMatch = true;
                }

                if(currentScope.data && currentScope.data.type === 'enum' && token != '') {
                    currentScope.data.values.push(token.replace(',', '').trim());
                    token = '';
                }

                lineNum++;
            }

            // ignore literals and comments
            if(ch === '"') canMatch = !canMatch;
            if(ch === '*') {
                if(code[i - 1] === '*' && code[i - 2] === '/') {
                    token = token.substr(0, token.length - 2);
                    docComment = true;
                    canMatch = true;
                } else if(code[i - 1] === '/') {
                    token = token.substr(0, token.length - 1);
                    canMatch = false;
                    mlComm = true;
                    continue;
                }
            }
            if(ch === '/' && code[i - 1] === '*') {
                canMatch = true;
                docComment = false;
                mlComm = false;
                continue;
            }

            if(ch === '/' && code[i + 1] === '/') {
                canMatch = false;
                mlComm = false;
            }

            // we skip new lines, indentations comments and literals
            if(!(ignoredChars.includes(ch) || !canMatch ||(ch === ' ' && code[i + 1] === ' '))) {
                if(docComment) {
                    doc += ch;
                    continue; // don't parse things that are in doc
                }

                token += ch;

                // attributes
                if(ch === ']' && currentScope.data && currentScope.data.type) { // if scope have a type, it can have an attribute
                    if(attrMatch = token.match(this.re.attributes)) {
                        attributes = [];
                        for(attrib of attrMatch[1].split(',')) {
                            let parsedAttr = attrib.trim().match(this.re.attribute);
                            if(parsedAttr) {
                                attributes.push({
                                    name: parsedAttr[1],
                                    parameters: parsedAttr[2] // TODO : parse them
                                });
                            }
                        }
                        token = '';
                        continue;
                    }
                }

                if(ch === '{') {

                    let parsedDoc = this.parseDoc(doc);
                    doc = '';

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
                        data: {
                            attributes: attributes
                        }
                    };
                    currentScope.children.push(newScope);
                    currentScope = newScope;

                    token = '';

                    if(nsMatch = currentScope.name.match(this.re.ns)) {
                        currentScope.data = {
                            type: 'namespace',
                            name: nsMatch[1]
                        };
                        continue;
                    }

                    if(klassMatch = currentScope.name.match(this.re.klass)) {
                        currentScope.data = {
                            type: 'class',
                            name: klassMatch[4] ? klassMatch[3].replace(klassMatch[4], '') : klassMatch[3],
                            access: klassMatch[1] ? klassMatch[1].trim() : 'public', // TODO: check if default visibility is really public
                            modifier: klassMatch[2] ? klassMatch[2].trim() : null,
                            inherits: klassMatch[5] ? klassMatch[5].replace(' : ', '').split(',').map((el) => { return el.trim(); }) : [],
                            generics: klassMatch[4] ? klassMatch[4].slice(1, klassMatch[4].length - 1).split(',').map((el) => { return el.trim(); }) : null
                        };
                        continue;
                    }

                    if(ifaceMatch = currentScope.name.match(this.re.iface)) {
                        currentScope.data = {
                            type: 'interface',
                            name: ifaceMatch[2],
                            access: ifaceMatch[1] ? ifaceMatch[1].trim() : 'public',
                            inherits: ifaceMatch[3] ? ifaceMatch[3] : null,
                        };
                        continue;
                    }

                    if(structMatch = currentScope.name.match(this.re.struct)) {
                        currentScope.data = {
                            type: 'struct',
                            name: structMatch[2],
                            access: structMatch[1] ? structMatch[1] : 'public',
                            inherits: structMatch[3] ? structMatch[3] : null
                        };
                    }

                    if(methMatch = currentScope.name.match(this.re.method)) {

                        let params = [];
                        for(param of methMatch[6].split(',')) {
                            let par = {};
                            param = param.trim();
                            let splitted = param.split(' ');
                            if(splitted.length === 3) { // ref or out
                                par.modifier = splitted[0];
                            }
                            par.name = splitted[splitted.length - 1];
                            par.type = splitted[splitted.length - 2];

                            if(currentScope.documentation.param) {
                                for(docParam of currentScope.documentation.param) {
                                    if(docParam.split(' ')[0] === par.name) {
                                        par.description = docParam.replace(par.name + ' ', '');
                                    }
                                }
                            }
                            params.push(par);
                            currentScope.vars.push({
                                name: par.name,
                                documentation: par.description,
                                type: par.type,
                                isConst: false,
                                initialValue: '?',
                                line: lineNum
                            });
                        }

                        if(currentScope.top.data && currentScope.top.data.type === 'class' && methMatch[5].split('.')[0] === currentScope.top.data.name) {
                            // not a method, but a constructor
                            currentScope.data = {
                                type: 'ctor',
                                name: methMatch[5],
                                access: methMatch[3],
                                parameters: methMatch[6],
                                parsedParameters: params
                            };
                            continue;
                        } else {
                            // it's really a method
                            currentScope.data = {
                                type: 'method',
                                returnType: methMatch[4],
                                name: methMatch[5],
                                access: methMatch[1] ? methMatch[1].trim() : 'private',
                                modifier: methMatch[2] ? methMatch[2].trim() : null,
                                unowned: methMatch[3] != undefined,
                                parameters: methMatch[6],
                                parsedParameters: params,
                                throws: methMatch[7]
                            };
                            continue;
                        }
                    }

                    if(propMatch = currentScope.name.match(this.re.prop)) {
                        if(propMatch[4] != 'enum' && propMatch[4] != 'errordomain') {
                            currentScope.data = {
                                type: 'property',
                                name: propMatch[6],
                                valueType: propMatch[4],
                                access: propMatch[1] ? propMatch[1].trim() : 'private',
                                modifier: propMatch[2] ? propMatch[2].trim() : null,
                                unowned: propMatch[3] != undefined
                            };
                            continue;
                        }
                    }

                    // foc = Field Or Constant
                    if((focMatch = currentScope.name.match(this.re.fieldOrConst)) && currentScope.top.data &&(
                        currentScope.top.data.type === 'namespace' ||
                        currentScope.top.data.type === 'class' ||
                        currentScope.top.data.type === 'interface' ||
                        currentScope.top.data.type === 'struct'
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
                    if(feMatch) {
                        currentScope.vars.push({
                            name: feMatch[2],
                            type: feMatch[1],
                            isConst: false,
                            initialValue: '?',
                            line: lineNum
                        });
                        continue;
                    }

                    if(enumMatch = currentScope.name.match(this.re.enumeration)) {
                        currentScope.data = {
                            type: 'enum',
                            name: enumMatch[2],
                            access: enumMatch[1],
                            values: []
                        };
                        continue;
                    }
                }

                if(ch === '}') {
                    currentScope.at[1] = [lineNum, i + 1];
                    if(currentScope.top) {
                        currentScope = currentScope.top;
                    } else {
                        console.error(`Closing a scope that is not open.(${path})`);
                    }

                    token = '';
                }

                if(ch === ';') {

                    trimedToken = token.trim();
                    token = '';

                    if(signalMatch = trimedToken.match(this.re.signal)) {
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
                                type: 'signal',
                                name: signalMatch[5],
                                returnType: signalMatch[4],
                                access: signalMatch[1] ? signalMatch[1].trim() : 'private',
                                modifier: signalMatch[2] ? signalMatch[2].trim() : null,
                                parameters: signalMatch[6] // TODO: parse them
                            }
                        });
                    }

                    // it could be a method, if we are in a .vapi file or in an interface, for instance
                    let methMatch = trimedToken.match(this.re.method);
                    if(methMatch) {

                        let params = [];
                        let vars = [];
                        for(param of methMatch[6].split(',')) {
                            if(param === '') { break; } // there is no parameters
                            let par = {};
                            param = param.trim();
                            let splitted = param.split(' ');
                            if(splitted.length === 3) { // ref or out
                                par.modifier = splitted[0];
                            }
                            // FIXME: it takes default values and `=` if there is
                            par.name = splitted[splitted.length - 1];
                            par.type = splitted[splitted.length - 2];

                            if(currentScope.documentation.param) {
                                for(docParam of currentScope.documentation.param) {
                                    if(docParam.split(' ')[0] === par.name) {
                                        par.description = docParam.replace(par.name + ' ', '');
                                    }
                                }
                            }
                            params.push(par);
                            vars.push({
                                name: par.name,
                                documentation: par.description,
                                type: par.type,
                                isConst: false,
                                initialValue: '?',
                                line: lineNum
                            });
                        }

                        if(currentScope.data && currentScope.data.type === 'class' && methMatch[5].split('.')[0] === currentScope.data.name) {
                            // not a method, but a constructor
                            currentScope.children.push({
                                top: currentScope,
                                at: [[lineNum, 0], [lineNum, trimedToken.length]],
                                name: trimedToken.replace(';', ' {'),
                                children: [],
                                vars: vars,
                                file: path,
                                documentation: {}, // TODO : add doc
                                vapi: isVapi,
                                data: {
                                    type: 'ctor',
                                    name: methMatch[5],
                                    access: methMatch[3],
                                    parameters: methMatch[6],
                                    parsedParameters: params
                                }
                            });
                            continue;
                        } else {
                            // it's really a method
                            currentScope.children.push({
                                top: currentScope,
                                at: [[lineNum, 0], [lineNum, trimedToken.length]],
                                name: trimedToken.replace(';', ' {'),
                                children: [],
                                vars: vars,
                                file: path,
                                documentation: {}, // todo : add doc
                                vapi: isVapi,
                                data: {
                                    type: 'method',
                                    returnType: methMatch[4],
                                    name: methMatch[5],
                                    access: methMatch[1] ? methMatch[1].trim() : 'private',
                                    modifier: methMatch[2] ? methMatch[2].trim() : null,
                                    unowned: methMatch[3] != undefined,
                                    parameters: methMatch[6],
                                    parsedParameters: params,
                                    throws: methMatch[7]
                                }
                            });
                            continue;
                        }
                    }

                    // it could also be a static field or constant
                    // TODO : add data here
                    let fieldMatch = trimedToken.match(this.re.fieldOrConst);
                    if(fieldMatch) {
                        currentScope.children.push({
                            top: currentScope,
                            at: [[lineNum, 0], [lineNum, trimedToken.length]],
                            name: trimedToken,
                            children: [],
                            vars: [],
                            file: path,
                            documentation: {},
                            vapi: isVapi
                        });
                    }


                    let match = trimedToken.match(this.re.localVar);
                    if(match) {
                        currentScope.vars.push({
                            name: match[5],
                            type: match[2],
                            isConst:(match[1] ? true : false),
                            initialValue: match[6],
                            line: lineNum
                        });
                    }

                    let nvMatch = trimedToken.match(this.re.nullVar);
                    if(nvMatch && nvMatch[1] != 'using') {
                        currentScope.vars.push({
                            name: nvMatch[2],
                            type: nvMatch[1],
                            isConst: false,
                            initialValue: 'null',
                            line: lineNum
                        });
                    }
                }
            }
        }
    }

    parseDoc(doc){
        // doc parsing
        let firstLine = true;
        let parsedDoc = {};
        doc = doc.replace(this.re.docStart, '');
        for(docLine of doc.split('*')) {
            // for each line ...
            docLine = docLine.trim();
            if(firstLine && docLine && docLine != '') {
                // if we are on the first line, we set short description
                parsedDoc.short = docLine;
                firstLine = false;
            } else if(docLine && docLine != '') {
                // else, we try to find taglets
                let tagletMatch = docLine.match(this.re.taglet);
                if(tagletMatch) {
                    let taglet = tagletMatch[1];
                    let data = tagletMatch[2];
                    if(!parsedDoc[taglet]) {
                        parsedDoc[taglet] = [];
                    }
                    parsedDoc[taglet].push(data);
                } else {
                    // if there are no taglets, this line is a part of the long description
                    if(!parsedDoc.long) parsedDoc.long = '';
                    parsedDoc.long += docLine + '\n';
                }
            } else if(docLine === '' && !firstLine) {
                // if we are in the long description, and the line is empty, it's a linebreak in fact
                if(!parsedDoc.long) parsedDoc.long = '';
                parsedDoc.long += '\n';
            }
        }
        return parsedDoc;
    }
}
