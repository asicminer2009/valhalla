'use babel';

import * as path from 'path';

// TODO : comment this file

export default class DocViewer {

    constructor(scopes) {
        this.scopes = scopes;
        atom.deserializers.add(this);
        this.element = document.createElement('div');
        this.element.className = "pane-item valadoc";
    }

    load(uri) {
        this.element.innerHTML = '';
        this.uri = uri;

        console.log(uri);

        if (uri == path.sep) {
            this.home();
        } else {
            let currentScope;
            const parts = uri.split(path.sep).filter((p) => { return p != ''; });
            let deepness = 1;

            let explore = (scope) => {

                if (scope.data && (scope.data.name || scope.data.type == 'global') && scope.data.name == parts[deepness]) {
                    console.log(scope, parts);
                    currentScope = scope;
                    if (deepness - 1 != parts.length) {
                        deepness++;
                        for (child of scope.children) {
                            explore(child);
                        }
                    }
                }
            };


            for (scope of this.scopes) {
                if (scope.file.replace('.vapi', '') == parts[0]) {
                    scope.data.name == parts[0];
                    explore(scope);
                    if (!currentScope) {
                        for (ch of scope.children) {
                            explore(ch);
                        }
                    }
                }
            }

            // header
            const header = document.createElement('header');
            const homeLink = document.createElement('a');
            homeLink.className = 'icon icon-home';
            homeLink.addEventListener('click', () => {
                console.log('home !');
                this.load('/');
            });
            header.appendChild(homeLink);

            for (let i = 0; i < parts.length; i++) {
                const p = parts[i];
                const url = '/' + parts.slice(0, i + 1).join(path.sep);
                const link = document.createElement('a');
                link.innerHTML = p;
                link.href = '#';
                console.log('adding evt listener for', p);
                link.onclick = () => {
                    this.load (url);
                };
                const chevron = document.createElement('span');
                chevron.className = 'icon icon-chevron-right';
                header.appendChild(chevron);
                header.appendChild(link);
            }

            this.element.appendChild(header);

            if (!currentScope) { this.error (`Can't find documentation for : "valadoc://${uri}"`); return; }

            switch (currentScope.data.type) {
                case 'global':
                    this.pack(currentScope);
                    break;
                case 'namespace':
                    this.ns(currentScope);
                    break;
                case 'class':
                    this.cls(currentScope);
                    break;
                case 'property':
                    this.prop(currentScope);
                    break;
                case 'method':
                    this.method(currentScope);
                    break;
                case 'ctor':
                    this.ctor(currentScope);
                    break;
                case 'enum':
                    this.enumeration(currentScope);
                    break;
                default:
                    this.error(`Unsupported scope type : ${currentScope.data.type}. But don't worry, it will be fixed soon.`, 'scope = ' + JSON.stringify(currentScope, (k, v) => {
                        if (v && k && (k == 'top' || k == 'children')) {
                            return;
                        } else {
                            return v;
                        }
                    }, '\t'));
                    break;
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
        for (let i = 0; i < placeholdersCount; i++) {
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

        displayPackages = (filter) => {
            packageList.innerHTML = '';
            packageList.className = 'list-group';
            for (scope of this.scopes) {
                if (scope.file.endsWith('.vapi')) {
                    if (!filter || filter == '' || scope.file.includes(filter)) {
                        let pack = document.createElement('li');
                        pack.innerHTML = scope.file.replace('.vapi', '');
                        if (filter && filter != '') { pack.innerHTML = pack.innerHTML.replace(filter, `<strong>${filter}</strong>`); }
                        pack.className = 'list-item';
                        const packUri = '/' + scope.file.replace('.vapi', '');
                        pack.addEventListener('click', () => {
                            this.load(packUri);
                        });

                        packageList.appendChild(pack);
                    }
                }
            }

            if (packageList.innerHTML == '') {
                packageList.innerHTML = `<li>No results for "${filter}"</li>`;
                packageList.className = 'background-message centered';
            }
        };

        let searchGroup = document.createElement('div');
        searchGroup.classList = ['block'];

        let searchLabel = document.createElement('label');
        searchLabel.innerHTML = 'Search in the package list.';
        searchGroup.appendChild(searchLabel);

        let search = document.createElement('atom-text-editor');
        search.addMiniAttribute();
        search.addEventListener('keyup', () => {
            const searchedText = search.getModel().getText();
            displayPackages(searchedText);
        });
        search.getModel().setPlaceholderText(placeholders.join(', ') + '...');
        searchGroup.appendChild(search);

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
        msg.innerHTML = err + ' Debugging informations :';

        const infos = document.createElement('pre');
        if (debugInfo) {
            infos.innerHTML = debugInfo;
        }

        const backBt = document.createElement('button');
        backBt.className = 'btn btn-info';
        backBt.innerHTML = 'Go back home';
        backBt.addEventListener('click', () => {
            this.load('/');
        });

        this.element.appendChild(title);
        this.element.appendChild(msg);
        if (debugInfo) { this.element.appendChild(infos); }
        this.element.appendChild(backBt);
    }

    enumeration (enumScope) {
        const title = document.createElement('h1');
        title.innerHTML = `The <code>${enumScope.data.name}</code> enumeration`;

        const dec = document.createElement('atom-text-editor');
        dec.addMiniAttribute();
        dec.getModel().setGrammar(atom.grammars.grammarForScopeName('source.vala'));
        dec.getModel().setText(enumScope.name);
        dec.contentEditable = false;
        dec.addEventListener('focus', (evt) => {
            dec.blur();
            evt.preventDefault();
        });

        const valuesTitle = document.createElement('h2');
        valuesTitle.innerHTML = 'Values';
        const valuesList = document.createElement('ul');
        valuesList.className = 'list-group';

        for (const v of enumScope.data.values) {
            const val = document.createElement('li');
            val.innerHTML = v;
            valuesList.appendChild(val);
        }

        this.element.appendChild(title);
        this.element.appendChild(dec);
        this.element.appendChild(valuesTitle);
        this.element.appendChild(valuesList);
    }

    cls (clsScope) {
        const title = document.createElement('h1');
        title.innerHTML = `The <code>${clsScope.data.name}</code> class`;
        const subtitle = document.createElement('h2');
        subtitle.className = 'subtitle';
        subtitle.innerHTML = `From the ${clsScope.file.replace('.vapi', '')} package.`;

        const dec = document.createElement('atom-text-editor');
        dec.addMiniAttribute();
        dec.getModel().setGrammar(atom.grammars.grammarForScopeName('source.vala'));
        dec.getModel().setText(clsScope.name);
        dec.contentEditable = false;
        dec.addEventListener('focus', (evt) => {
            dec.blur();
            evt.preventDefault();
        });

        const ctorTitle = document.createElement('h2');
        ctorTitle.innerHTML = 'Constructors';
        const ctorList = document.createElement('ul');
        ctorList.className = 'list-group';

        const methTtitle = document.createElement('h2');
        methTtitle.innerHTML = 'Methods';
        const methList = document.createElement('ul');
        methList.className = 'list-group';

        const propTitle = document.createElement('h2');
        propTitle.innerHTML = 'Properties';
        const propList = document.createElement('ul');
        propList.className = 'list-group';

        for (const child of clsScope.children) {
            if (child.data) {
                switch (child.data.type) {
                    case 'ctor':
                        const ctor = document.createElement('li');
                        ctor.innerHTML = child.data.name;
                        ctor.className = 'list-item';
                        ctor.addEventListener('click', () => {
                            this.load(path.join(this.uri, child.data.name));
                        });
                        ctorList.appendChild(ctor);
                        break;
                    case 'method':
                        const meth = document.createElement('li');
                        meth.innerHTML = child.data.name;
                        meth.className = 'list-item';
                        const url = path.join(this.uri, child.data.name);
                        meth.addEventListener('click', () => {
                            this.load(url);
                        });
                        methList.appendChild(meth);
                        break;
                    case 'property':
                        const prop = document.createElement('li');
                        prop.innerHTML = child.data.name;
                        prop.className = 'list-item';
                        prop.addEventListener('click', () => {
                            this.load(path.join(this.uri, child.data.name));
                        });
                        propList.appendChild(prop);
                        break;
                    default:
                        break;
                }
            }
        }

        this.element.appendChild(title);
        this.element.appendChild(subtitle);
        this.element.appendChild(dec);

        if (ctorList.children.length) {
            this.element.appendChild(ctorTitle);
            this.element.appendChild(ctorList);
        }

        if (methList.children.length) {
            this.element.appendChild(methTtitle);
            this.element.appendChild(methList);
        }

        if (propList.children.length) {
            this.element.appendChild(propTitle);
            this.element.appendChild(propList);
        }
    }

    method(methScope) {
        const title = document.createElement('h1');
        let name = methScope.data.name;
        if (methScope.top.data.type == 'class') {
            name = methScope.top.data.name + '.' + name;
        }
        title.innerHTML = `The <code>${name}</code> method`;

        const dec = document.createElement('atom-text-editor');
        dec.addMiniAttribute();
        dec.getModel().setGrammar(atom.grammars.grammarForScopeName('source.vala'));
        dec.getModel().setText(methScope.name);
        dec.contentEditable = false;
        dec.addEventListener('focus', (evt) => {
            dec.blur();
            evt.preventDefault();
        });

        // TODO : arguments

        this.element.appendChild(title);
        this.element.appendChild(dec);
    }

    prop(propScope) {
        const title = document.createElement('h1');
        let name = propScope.data.name;
        if (propScope.top.data.type == 'class') {
            name = propScope.top.data.name + '.' + name;
        }
        title.innerHTML = `The <code>${name}</code> property`;

        const dec = document.createElement('atom-text-editor');
        dec.addMiniAttribute();
        dec.getModel().setGrammar(atom.grammars.grammarForScopeName('source.vala'));
        dec.getModel().setText(propScope.name);
        dec.contentEditable = false;
        dec.addEventListener('focus', (evt) => {
            dec.blur();
            evt.preventDefault();
        });

        this.element.appendChild(title);
        this.element.appendChild(dec);
    }

    ctor(ctorScope) {
        const title = document.createElement('h1');
        title.innerHTML = `The <code>${ctorScope.data.name}</code> constructor`;

        const dec = document.createElement('atom-text-editor');
        dec.addMiniAttribute();
        dec.getModel().setGrammar(atom.grammars.grammarForScopeName('source.vala'));
        dec.getModel().setText(ctorScope.name);
        dec.contentEditable = false;
        dec.addEventListener('focus', (evt) => {
            dec.blur();
            evt.preventDefault();
        });

        // TODO : arguments

        this.element.appendChild(title);
        this.element.appendChild(dec);
    }

    ns(nsScope) {
        const title = document.createElement('h1');
        title.innerHTML = `The <code>${nsScope.data.name}</code> namespace`;
        const subtitle = document.createElement('h2');
        subtitle.className = 'subtitle';
        subtitle.innerHTML = `From the ${nsScope.file.replace('.vapi', '')} package.`;

        const clsTitle = document.createElement('h2');
        clsTitle.innerHTML = 'Classes';
        const clsList = document.createElement('ul');
        clsList.className = 'list-group';

        const methTitle = document.createElement('h2');
        methTitle.innerHTML = 'Methods';
        const methList = document.createElement('ul');
        methList.className = 'list-group';

        const enumTitle = document.createElement('h2');
        enumTitle.innerHTML = 'Enumerations';
        const enumList = document.createElement('ul');
        enumList.className = 'list-group';

        for (const child of nsScope.children) {
            if (child.data) {
                switch (child.data.type) {
                    case 'class':
                        const cls = document.createElement('li');
                        cls.innerHTML = child.data.name;
                        cls.className = 'list-item';
                        cls.addEventListener('click', () => {
                            this.load(path.join(this.uri, child.data.name));
                        });
                        clsList.appendChild(cls);
                        break;
                    case 'method':
                        const meth = document.createElement('li');
                        meth.innerHTML = child.data.name;
                        meth.className = 'list-item';
                        meth.addEventListener('click', () => {
                            this.load(path.join(this.uri, child.data.name));
                        });
                        methList.appendChild(meth);
                        break;
                    case 'enum':
                        const en = document.createElement('li');
                        en.innerHTML = child.data.name;
                        en.className = 'list-item';
                        en.addEventListener('click', () => {
                            this.load(path.join(this.uri, child.data.name));
                        });
                        enumList.appendChild(en);
                        break;
                    default:
                        break;
                }
            }
        }

        this.element.appendChild(title);
        this.element.appendChild(subtitle);
        if (clsList.children.length) {
            this.element.appendChild(clsTitle);
            this.element.appendChild(clsList);
        }

        if (methList.children.length) {
            this.element.appendChild(methTitle);
            this.element.appendChild(methList);
        }

        if (enumList.children.length) {
            this.element.appendChild(enumTitle);
            this.element.appendChild(enumList);
        }
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
        openVapi.addEventListener('click', () => {
            const filePath = path.join(atom.config.get('valhalla.vapiDir'), pkg.file);
            atom.workspace.open(filePath).then((editor) => {
                editor.setGrammar(atom.grammars.grammarForScopeName('source.vala'));
            });
        });

        const nsTitle = document.createElement('h2');
        nsTitle.innerHTML = 'Namespaces';
        const nsList = document.createElement('ul');
        nsList.className = 'list-group';

        for (const child of pkg.children) {
            if (child.data) {
                switch (child.data.type) {
                    case 'namespace':
                        const ns = document.createElement('li');
                        ns.innerHTML = child.data.name;
                        ns.className = 'list-item';
                        ns.addEventListener('click', () => {
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
