# Changelog

# 0.14.0
- Support for generics types
- Methods suggestions now shows you parameters
- Symbols are now loaded from every Vala file you can see in your tree view (project's files)
- You can specify multiple directories for `.vapi` files in your settings. On Linux, `.vapi` files are also loaded from
`/usr/share/vala/vapi/`.

# 0.13.0
- Making enumerations less invasives
- Suggesting namespaces in project when writing a new one (e.g. when writing `namespace F...`)
- Fixed the "Surround with..." function

# 0.12.0
- Support for atom-builder. You can now build your app in one click if you atom-builder installed.

# 0.11.4
- Support for the `unowned` keyword
- Valadoc comments highlighting

# 0.11.3
- Updated README

# 0.11.2
- Removed TODO

# 0.11.1
- Updated README and TODO

## 0.11.0 - Complete rewrite
- Complete rewrite of the suggestions provider (it was broken after Atom 1.8 update). It would be smarter now.
- Better support for structs and interfaces
- Documentation viewer ! :book: You can display it by going in the `Vala` menu and then `Documentation`, or by trigerring the `valhalla:documentation` command, using the command palette.
- Support for enumerations

## 0.5.0
- Suggestion for instance members, when typing `this`
- Error if using `this` when not in a class
- Menu to quickly create new classes or interfaces

## 0.4.0
- Added support of local variables
- Added support of local variables properties and methods

## 0.3.2
* Added support for delegates and signals

## 0.3.1 - Doing things with `apm`
* Experimenting with `apm publish`, so the version number isn't very logical ... :grin:
