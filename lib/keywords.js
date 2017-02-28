'use babel'

export default [
  {
    name: 'this',
    scope: 'class.method, class.ctor',
    completion: 'this',
    description: 'A reference to the current instance.'
  },
  {
    name: 'public',
    scope: 'file, namespace, class, interface, struct',
    completion: 'public '
  },
  {
    name: 'private',
    scope: 'file, namespace, class, interface, struct',
    completion: 'private '
  },
  {
    name: 'internal',
    scope: 'file, namespace',
    completion: 'internal '
  },
  {
    name: 'protected',
    scope: 'class, interface, struct',
    completion: 'internal '
  },
  {
    name: 'void',
    scope: 'file, namespace, class, interface, struct, enum',
    completion: 'void '
  },
  {
    name: 'abstract',
    scope: 'file, namespace, class, interface',
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
    scope: 'file, namespace, class',
    completion: 'class $1 {\n\t$2\n}',
    description: 'Class declaration.'
  },
  {
    name: 'struct',
    scope: 'file, namespace, class',
    completion: 'struct $1 {\n\t$2\n}',
    description: 'Structure declaration.'
  },
  {
    name: 'interface',
    scope: 'file, namespace, class',
    completion: 'interface $1 {\n\t$2\n}',
    description: 'Interface declaration'
  },
  {
    name: 'namespace',
    scope: 'file, namespace',
    completion: 'namespace $1 {\n\t$2\n}',
    description: 'Namespace declaration'
  },
  {
    name: 'const',
    scope: 'file, namespace, class, struct, interface, method, ctor',
    completion: 'const ',
    description: 'Constant, known at compile-time'
  },
  {
    name: 'signal',
    scope: 'file, namespace, class, interface',
    completion: 'signal '
  },
  {
    name: 'if',
    scope: 'method, ctor',
    completion: 'if ($1) {\n\t$2\n}',
    description: 'Simple condition'
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
    completion: 'in ',
    description: 'Usage: a in b. Equivalent to b.contains (a)'
  },
  {
    name: 'as',
    scope: 'method, ctor',
    completion: 'as ',
    description: 'Convert an object to another type. Be carefull it can return null if the cast is invalid.'
  },
  {
    name: 'foreach',
    scope: 'method, ctor',
    completion: 'foreach ($1 in $2) {\n\t$3\n}',
    description: 'Loop to iterate over lists'
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
    scope: 'file',
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
]
