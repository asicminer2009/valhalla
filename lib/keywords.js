'use babel';

export default [
    {
        name: 'this',
        scope: 'class.method, class.ctor',
        completion: 'this'
    },
    {
        name: 'public',
        scope: 'global, namespace, class, interface, struct',
        completion: 'public '
    },
    {
        name: 'private',
        scope:  'global, namespace, class, interface, struct',
        completion: 'private '
    },
    {
        name: 'internal',
        scope: 'global, namespace',
        completion: 'internal '
    },
    {
        name: 'protected',
        scope: 'class, interface, struct',
        completion: 'internal '
    },
    {
        name: 'void',
        scope: 'global, namespace, class, interface, struct, enum',
        completion: 'void '
    },
    {
        name: 'abstract',
        scope: 'global, namespace, class, interface',
        completion: 'abstract '
    },
    {
        name: 'static',
        scope: 'class, interface',
        completion: 'static '
    },
    {
        name: 'override',
        scope: 'class, interface',
        completion: 'override '
    },
    {
        name: 'virtual',
        scope: 'class, interface',
        completion: 'virtual'
    },
    {
        name: 'class',
        scope: 'global, namespace',
        completion: 'class $1 {\n\t$2\n}'
    },
    {
        name: 'struct',
        scope: 'global, namespace',
        completion: 'struct $1 {\n\t$2\n}'
    },
    {
        name: 'interface',
        scope: 'global, namespace',
        completion: 'interface $1 {\n\t$2\n}'
    },
    {
        name: 'namespace',
        scope: 'global, namespace',
        completion: 'namespace $1 {\n\t$2\n}'
    },
    {
        name: 'const',
        scope: 'global, namespace, class, struct, interface, method, ctor',
        completion: 'const '
    },
    {
        name: 'signal',
        scope: 'global, namespace, class, interface',
        completion: 'signal '
    },
    {
        name: 'if',
        scope: 'method, ctor',
        completion: 'if ($1) {\n\t$2\n}',
    },
    {
        name: 'else',
        scope: 'method, ctor',
        completion: 'else {\n\t$1\n}'
    },
    {
        name: 'else if',
        scope: 'method, ctor',
        completion: 'else if ($1) {\n\t$2\n}'
    },
    {
        name: 'for',
        scope: 'method, ctor',
        completion: 'for ($1; $2; $3) {\n\t$4\n}'
    },
    {
        name: 'in',
        scope: 'method, ctor',
        completion: 'in '
    },
    {
        name: 'as',
        scope: 'method, ctor',
        completion: 'as '
    },
    {
        name: 'foreach',
        scope: 'method, ctor',
        completion: 'foreach ($1 in $2) {\n\t$3\n}'
    },
    {
        name: 'do',
        scope: 'method, ctor',
        completion: 'do {\n\t$2\n} while ($1);'
    },
    {
        name: 'while',
        scope: 'method, ctor',
        completion: 'while ($1) {\n\t$2\n}'
    },
    {
        name: 'switch',
        scope: 'method, ctor',
        completion: 'switch ($1) {\n\tcase $2:\n\t\t$3\n\t\tbreak;\n\tdefault:\n\t\t$4\n\t\tbreak;\n}'
    },
    {
        name: 'case',
        scope: 'switch',
        completion: 'case $1:\n\t$2\n\tbreak;'
    },
    {
        name: 'new',
        scope: 'method, ctor',
        completion: 'new '
    },
    {
        name: 'using',
        scope: 'global',
        completion: 'using '
    },
    {
        name: 'try',
        scope: 'method, ctor',
        completion: 'try {\n\t$1\n} catch (\${2:Error err}) {\n\t$3\n}'
    },
    {
        name: 'catch',
        scope: 'method, ctor',
        completion: 'catch (\${1:Error err}) {\n\t$2\n}'
    },
    {
        name: 'finally',
        scope: 'method, ctor',
        completion: 'finally {\n\t$1\n}'
    }
];
