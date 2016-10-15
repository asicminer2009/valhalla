'use babel';

import * as path from 'path';
import Valadoc from './valadoc';
import * as main from './valhalla';

// TODO : comment this file

export default class DocViewer {

    constructor(state) {
        this.scopes = main.default.getScopes();
        this.element = document.createElement('div');
        this.element.className = "pane-item valadoc";

        this.packSearchRe = /\bpackage:(\S*)\b/;

        this.models = [
            {
                name: 'Package',
                plural: 'Packages',
                noDeclaration: true,
                is: (scope) => {
                    return scope.data && scope.data.type  === 'global';
                },
                title: (scope) => {
                    return 'The ' + scope.file.replace('.vapi', '') + ' package';
                },
                item: (scope) => {
                    return scope.file.replace('.vapi', '');
                },
                page: (scope) => {
                    return this.doc (`http://valadoc.org/${scope.file.replace('.vapi', '')}/index.htm.content.tpl`);
                }
            },
            {
                name: 'Namespace',
                plural: 'Namespaces',
                is: (scope) => {
                    return scope.data && scope.data.type  === 'namespace';
                },
                item: (scope) => {
                    return scope.data.name;
                },
                page: (scope) => {
                    return this.doc (scope);
                }
            },
            {
                name: 'Class',
                plural: 'Classes',
                is: (scope) => {
                    return scope.data && scope.data.type  === 'class';
                },
                item: (scope) => {
                    return scope.data.name;
                },
                page: (scope) => {
                    return this.doc (scope);
                }
            },
            {
                name: 'Struct',
                plural: 'Structs',
                is: (scope) => {
                    return scope.data && scope.data.type  === 'struct';
                },
                item: (scope) => {
                    return scope.data.name;
                },
                page: (scope) => {
                    return this.doc (scope);
                }
            },
            {
                name: 'Interface',
                plural: 'Interfaces',
                is: (scope) => {
                    return scope.data && scope.data.type  === 'interface';
                },
                item: (scope) => {
                    return scope.data.name;
                },
                page: (scope) => {
                    return this.doc (scope);
                }
            },
            {
                name: 'Method',
                plural: 'Methods',
                is: (scope) => {
                    return scope.data && scope.data.type  === 'method';
                },
                item: (scope) => {
                    let res = `${scope.data.name} (`;
                    const params = [];
                    for (const param of scope.data.parsedParameters) {
                        params.push((param.modifier ? `<span class="storage modifier vala">${param.modifier}</span> ` : '') +
                            `<span class="storage type vala">${param.type}</span> ` +
                            `<span class="variable parameter vala">${param.name}</span>`
                        );
                    }
                    res += params.join(', ');
                    res += ')'
                    return res;
                },
                page: (scope) => {
                    return this.doc (scope);
                }
            },
            {
                name: 'Constructor',
                plural: 'Constructors',
                is: (scope) => {
                    return scope.data && scope.data.type  === 'ctor';
                },
                item: (scope) => {
                    let res = `${scope.data.name} (`;
                    const params = [];
                    for (const param of scope.data.parsedParameters) {
                        params.push((param.modifier ? `<span class="storage modifier vala">${param.modifier}</span> ` : '') +
                            `<span class="storage type vala">${param.type}</span> ` +
                            `<span class="variable parameter vala">${param.name}</span>`
                        );
                    }
                    res += params.join(', ');
                    res += ')';
                    return res;
                },
                page: (scope) => {
                    return this.doc (scope);
                }
            },
            {
                name: 'Property',
                plural: 'Properties',
                is: (scope) => {
                    return scope.data && scope.data.type  === 'property';
                },
                item: (scope) => {
                    return scope.data.name;
                },
                page: (scope) => {
                    return this.doc (scope);
                }
            },
            {
                name: 'Field',
                plural: 'Fields',
                is: (scope) => {
                    return scope.data && scope.data.type  === 'field';
                },
                item: (scope) => {
                    return scope.data.name;
                },
                page: (scope) => {
                    return this.doc (scope);
                }
            },
            {
                name: 'Enumeration',
                plural: 'Enumerations',
                is: (scope) => {
                    return scope.data && scope.data.type  === 'enum';
                },
                item: (scope) => {
                    return scope.data.name;
                },
                page: (scope) => {
                    const res = document.createElement('div');
                    res.appendChild(this.doc (scope));
                    const values = document.createElement('div');
                    values.innerHTML = '<h2>Values</h2><ul>';
                    for (const val of scope.data.values) {
                        values.innerHTML += `<li>${val}</li>`;
                    }
                    values.innerHTML += '</ul>';
                    res.appendChild(values);
                    return res;
                }
            }
        ];

        if (state && state.uri) {
            this.load(state.uri);
        }
    }

    serialize () {
        return {
            deserializer: 'DocViewer',
            uri: this.uri
        };
    }

    static deserialize (state) {
        const dv = new DocViewer(state);
        dv.load(state.uri);
        return dv;
    }

    doc(scope) {
        const el = document.createElement('div');
        el.innerHTML = 'Loading description...';
        el.className = 'text-info blink';
        new Valadoc().getDoc(scope, (doc) =>  {
            el.className = 'documentation';
            el.innerHTML = '';
            for (const part of doc) {
                if (part.type === 'paragraph') {
                    const par = document.createElement('p');
                    par.innerHTML = part.content;
                    el.appendChild(par);
                } else if (part.type === 'code') {
                    const code = document.createElement('atom-text-editor');
                    if (!part.content.includes('\n')) {
                        code.addMiniAttribute();
                    } else {
                        code.getModel().setGrammar(atom.grammars.grammarForScopeName('source.vala'));
                    }
                    code.getModel().setText(part.content);
                    code.contentEditable = false;
                    code.addEventListener('focus',(evt) => {
                        code.blur();
                        evt.preventDefault();
                    });
                    el.appendChild(code);
                }
            }
            if (el.childNodes.length === 0) {
                el.innerHTML = 'Can\'t find documentation.';
                el.className = 'text-error';
            }
        });
        return el;
    }

    load(uri) {
        this.element.innerHTML = '';
        this.uri = uri;


        if(uri === path.sep) {
            this.home();
        } else {
            let currentScope;
            const parts = uri.split(path.sep).filter((p) => { return p != ''; });
            let deepness = 1;

            const explore = (scope) => {

                if(scope.data &&(scope.data.name || scope.data.type === 'global') && scope.data.name === parts[deepness]) {
                    currentScope = scope;
                    if(deepness - 1 != parts.length) {
                        deepness++;
                        for(const child of scope.children) {
                            explore(child);
                        }
                    }
                }
            };


            for(const scope of this.scopes) {
                if(scope.file.replace('.vapi', '') === parts[0]) {
                    scope.data.name === parts[0];
                    explore(scope);
                    if(!currentScope) {
                        for(const ch of scope.children) {
                            explore(ch);
                        }
                    }
                }
            }

            // header
            const header = document.createElement('header');
            const homeLink = document.createElement('a');
            homeLink.className = 'icon icon-home';
            homeLink.addEventListener('click',() => {
                this.load('/');
            });
            header.appendChild(homeLink);

            for(let i = 0; i < parts.length; i++) {
                const p = parts[i];
                const url = '/' + parts.slice(0, i + 1).join(path.sep);
                const link = document.createElement('a');
                link.innerHTML = p;
                link.href = '#';
                link.onclick =() => {
                    this.load(url);
                };
                const chevron = document.createElement('span');
                chevron.className = 'icon icon-chevron-right';
                header.appendChild(chevron);
                header.appendChild(link);
            }

            const searchBt = document.createElement('a');
            searchBt.className = 'icon icon-search';
            searchBt.addEventListener('click', () => {
                this.element.innerHTML = '';

                const sBlock = document.createElement('div');
                sBlock.className = 'block';

                const schBox = document.createElement('atom-text-editor');
                schBox.addMiniAttribute();
                schBox.getModel().setPlaceholderText('Search in the documentation. Use package:a-package to search only in the a-package package.');
                const results = document.createElement('ul');
                schBox.addEventListener('keyup', () => {
                    let searchedText = schBox.getModel().getText();
                    let onlyIn;
                    if (match = searchedText.match(this.packSearchRe)) {
                        searchedText = searchedText.replace(this.packSearchRe, '').trim();
                        onlyIn = match[1];
                        console.log(searchedText, onlyIn, match);
                    }
                    results.innerHTML = '';
                    results.className = 'list-group';
                    let counter = 0;
                    const explore = (scope, url) => {
                        if (counter > 200) { return; }
                        for (const mod of this.models) {
                            if(scope.data && scope.data.name && mod.is(scope)) {
                                if(scope.data.name.toLowerCase().includes(searchedText.toLowerCase())) {
                                    const result = document.createElement('li');
                                    result.className = 'list-item';
                                    result.innerHTML = `<code class="no-bg">${mod.item(scope)}</code><span class="text-subtle"> &mdash; A ${mod.name.toLowerCase()}, from the ${scope.file.replace('.vapi', '')} package</span>`;
                                    result.addEventListener('click', () => {
                                        this.load(path.join(url, scope.data.name));
                                    });
                                    results.appendChild(result);
                                    counter++;
                                }
                                for (const ch of scope.children) {
                                    explore(ch, path.join(url, scope.data.name));
                                }
                            }
                        }

                        if (scope.data && scope.data.type === 'global') {
                            for (const ch of scope.children) {
                                explore(ch, path.join(url, scope.file.replace('.vapi', '')));
                            }
                        }
                    };

                    for (const scope of this.scopes.filter((s) => {
                        return s.file.endsWith('.vapi') && (!onlyIn || s.file.replace('.vapi', '') == onlyIn);
                    })) {
                        explore(scope, '/');
                    }

                    if (results.innerHTML === '') {
                        results.innerHTML = `<li>No results for "${searchedText}"</li>`;
                        results.className = 'background-message centered';
                    }
                });
                schBox.focus();
                sBlock.appendChild(schBox);

                const quitBt = document.createElement('a');
                quitBt.className = 'icon icon-x';
                quitBt.addEventListener('click', () => {
                    this.load(this.uri);
                });
                sBlock.appendChild(quitBt);
                this.element.appendChild(sBlock);
                this.element.appendChild(results);
            });

            header.appendChild(searchBt);
            this.element.appendChild(header);

            if(!currentScope) { this.error(`Can't find documentation for : "valadoc://${uri}"`); return; }

            for (const mod of this.models) {
                if (mod.is(currentScope)) {
                    // Title
                    const title = document.createElement('h1');
                    if (mod.title) {
                        title.innerHTML = mod.title(currentScope);
                        this.element.appendChild(title);
                    } else {
                        title.innerHTML = `The ${currentScope.data.name} ${mod.name.toLowerCase()}`;
                        this.element.appendChild(title);

                        const subtitle = document.createElement('h2');
                        subtitle.className = 'subtitle';
                        subtitle.innerHTML = `From the ${currentScope.file.replace('.vapi', '')} package`;
                        this.element.appendChild(subtitle);
                    }

                    // Page
                    if (mod.page) {
                        this.element.appendChild(mod.page(currentScope));
                    }

                    // Declaration
                    if (!mod.noDeclaration) {
                        const dec = document.createElement('atom-text-editor');
                        dec.addMiniAttribute();
                        dec.getModel().setGrammar(atom.grammars.grammarForScopeName('source.vala'));
                        dec.getModel().setText(currentScope.name);
                        dec.contentEditable = false;
                        dec.addEventListener('focus',(evt) => {
                            dec.blur();
                            evt.preventDefault();
                        });
                        this.element.appendChild(dec);
                    }

                    // Children
                    const children = [];
                    for (const child of currentScope.children) {
                        for (const model of this.models) {
                            if (model.is(child)) {
                                const list = children.find((el) => { return el.title === model.plural; }) || {};

                                if (!list.title) { // list isn't initialized yet.
                                    children.push(list);
                                    list.title = model.plural;
                                    list.items = [];
                                }
                                list.items.push({content: `<code class="no-bg">${model.item(child)}</code>`, path: child.data.name});
                            }
                        }
                    }

                    const toc = document.createElement('atom-panel');
                    toc.innerHTML = '<h3>Table of contents</h3>'
                    const top = 200;
                    toc.className = 'toc';
                    toc.style.top = `${top}px`;
                    this.element.appendChild(toc);

                    this.element.addEventListener('scroll', () => {
                        toc.style.top = `${this.element.scrollTop + top}px`;
                    });

                    const goTop = document.createElement('a');
                    goTop.innerHTML = 'Go up';
                    goTop.addEventListener('click', () => {
                        title.scrollIntoView();
                    });
                    toc.appendChild(goTop);

                    for (const ch of children) {
                        const title = document.createElement('h2');
                        title.innerHTML = ch.title;
                        this.element.appendChild(title);

                        const tocLink = document.createElement('a');
                        tocLink.innerHTML = ch.title;
                        tocLink.addEventListener('click', () => {
                            title.scrollIntoView();
                        });
                        toc.appendChild(tocLink);

                        const list = document.createElement('ul');
                        list.className = 'list-group';
                        for (const item of ch.items) {
                            const li = document.createElement('li');
                            li.className = 'list-item';
                            li.innerHTML = item.content;
                            list.appendChild(li);
                            li.addEventListener('click', () => {
                                const url = path.join(this.uri, item.path);
                                this.load(url);
                            });
                        }
                        this.element.appendChild(list);
                    }
                }
            }
        }
    }

    /*
    * Show a list of all the installed packages
    */
    home() {
        this.title = 'Vala documentation';

        placeholders = [];
        const placeholdersCount = 5;
        for(let i = 0; i < placeholdersCount; i++) {
            const vapiOnly = this.scopes.filter((s) => {
                return s.file.endsWith('.vapi');
            });
            const index = Math.floor(Math.random() * vapiOnly.length);
            placeholders.push(vapiOnly[index].file.replace('.vapi', ''));
        }

        let title = document.createElement('h1');
        title.innerHTML = this.title;

        let packageList = document.createElement('ul');
        packageList.className = 'list-group';

        displayPackages =(filter) => {
            packageList.innerHTML = '';
            packageList.className = 'list-group';
            for(const scope of this.scopes) {
                if(scope.file.endsWith('.vapi')) {
                    if(!filter || filter === '' || scope.file.includes(filter)) {
                        let pack = document.createElement('li');
                        pack.innerHTML = scope.file.replace('.vapi', '');
                        if(filter && filter != '') { pack.innerHTML = pack.innerHTML.replace(filter, `<strong>${filter}</strong>`); }
                        pack.className = 'list-item';
                        const packUri = '/' + scope.file.replace('.vapi', '');
                        pack.addEventListener('click',() => {
                            this.load(packUri);
                        });

                        packageList.appendChild(pack);
                    }
                }
            }

            if(packageList.innerHTML === '') {
                packageList.innerHTML = `<li>No results for "${filter}"</li>`;
                packageList.className = 'background-message centered';
            }
        };

        let searchGroup = document.createElement('div');
        let searchLabel = document.createElement('label');
        searchLabel.innerHTML = 'Search in the package list.';
        searchGroup.appendChild(searchLabel);

        let search = document.createElement('atom-text-editor');
        search.addMiniAttribute();
        search.addEventListener('keyup',() => {
            const searchedText = search.getModel().getText();
            displayPackages(searchedText);
        });
        search.getModel().setPlaceholderText(placeholders.join(', ') + '...');
        searchGroup.appendChild(search);
        search.focus();

        displayPackages();

        this.element.appendChild(title);
        this.element.appendChild(searchGroup);
        this.element.appendChild(packageList);
    }

    error(err, debugInfo) {
        const title = document.createElement('h1');
        title.innerHTML = 'Error !';

        const msg = document.createElement('p');
        msg.className = 'text-error';
        msg.innerHTML = err;

        const infos = document.createElement('pre');
        if(debugInfo) {
            msg.innerHTML += ' Debugging informations :';
            infos.innerHTML = debugInfo;
        }

        const backBt = document.createElement('button');
        backBt.className = 'btn btn-info';
        backBt.innerHTML = 'Go back home';
        backBt.addEventListener('click',() => {
            this.load('/');
        });

        this.element.appendChild(title);
        this.element.appendChild(msg);
        if(debugInfo) { this.element.appendChild(infos); }
        this.element.appendChild(backBt);
    }

    pack(pkg) {
        const title = document.createElement('h1');
        const icon = document.createElement('span');
        icon.className = 'icon icon-package';
        title.appendChild(icon);
        const pkgName = pkg.file.replace('.vapi', '');
        title.innerHTML += pkgName[0].toUpperCase() + pkgName.slice(1, pkgName.length);

        const openVapi = document.createElement('button');
        openVapi.className = 'btn btn-info';
        openVapi.innerHTML = 'Open <code>.vapi</code> file';
        atom.tooltips.add(openVapi, { title: `Open ${pkg.file}` });
        openVapi.addEventListener('click',() => {
            const filePath = path.join(atom.config.get('valhalla.vapiDir'), pkg.file);
            atom.workspace.open(filePath).then((editor) => {
                editor.setGrammar(atom.grammars.grammarForScopeName('source.vala'));
            });
        });

        const nsTitle = document.createElement('h2');
        nsTitle.innerHTML = 'Namespaces';
        const nsList = document.createElement('ul');
        nsList.className = 'list-group';

        for(const child of pkg.children) {
            if(child.data) {
                switch(child.data.type) {
                    case 'namespace':
                        const ns = document.createElement('li');
                        ns.innerHTML = child.data.name;
                        ns.className = 'list-item';
                        ns.addEventListener('click',() => {
                            this.load(path.join(this.uri, child.data.name));
                        });
                        nsList.appendChild(ns);
                        break;
                    default:
                        break;
                }
            }
        }

        this.element.appendChild(title);
        this.element.appendChild(openVapi);
        this.element.appendChild(nsTitle);
        this.element.appendChild(nsList);
    }

    getTitle() {
        return this.title;
    }

    getIconName() {
        return 'book';
    }

}
