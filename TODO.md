# TODO

*By priority*

- Doc comment coloration -> PR on `language-vala-modern`
- Snippets
- Fields
- Supports inherited members
- Support generics
- Refactoring
- Creating a child class (or an implementing one) by right-clicking on a class or interface name
- Detect errors (parses error from valac and display them with atom-linter)
- Debugger (gdb frontent)

## Bugs

- Support unowned keyword (look at gedit-2.20.vapi -> App class, and then look at it in the doc).
- Create two local variable, `t` and `bt`. Type `bt.`, and you'll also get suggestions for `t.`.
- Type a class name followed by a . (eg `TestClass.`). You get enums values
