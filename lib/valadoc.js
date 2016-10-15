'use babel';

import * as path from 'path';

const valadocUrl = 'valadoc.org';

export default class Valadoc {

    constructor() {

    }

    getDoc(scope, cb) {
        let url = '';
        let nonStrict = false;
        if (typeof scope === 'string') {
            url = scope;
            nonStrict = true;
        } else {
            let currentScope = scope;
            while(currentScope.top && currentScope.top.data && currentScope.data.type != 'global') {
                url = currentScope.data.name + '.' + url;
                currentScope = currentScope.top;
            }
            url = 'http://' + path.join(valadocUrl, scope.file.replace('.vapi', ''), url + 'html.content.tpl').replace('\\', '/');
        }

        console.log(url);
        fetch(url).then((res) => {
            return res.text();
        }).then((src) => {
            src = src.replace('<?xml version="1.0" encoding="utf-8"?>', '');
            const root = document.createElement('div');
            root.innerHTML = src;

            const doc = [];
            const explore = (elt) => {
                const children = [].slice.call(elt.childNodes);
                for(const child of children) {
                    if(child.parentElement.className === 'description' || nonStrict) {
                        if (child.tagName === 'P') {
                            let content = child.innerHTML;
                            while(content.includes('<img src="img/')) {
                                content = content.replace('<img src="img/', '<img src="http://valadoc.org/' + scope.file.replace('.vapi', '') + '/img/');
                            }
                            doc.push({
                                type: 'paragraph',
                                content: content
                            });
                        } else if (child.tagName === 'PRE') {
                            doc.push({
                                type: 'code',
                                content: child.innerText
                            });
                        }
                    }

                    explore(child);
                }
            }
            explore(root);

            cb(doc);
        }).catch((err) => {
            console.error(err);
        });
    }

};
