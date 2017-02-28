'use babel'

export default class DocProvider {
  constructor () {
    this.selector = '.source.vala .comment.block.documentation.javadoc'
    this.inclusionPriority = 10
    this.excludeLowerPriority = true
    this.prefixRegex = /[\w@]+$/
    this.taglets = [
      {
        name: 'inheritDoc',
        snippet: `{@inheritDoc}`,
        description: 'Use the same description as the parent.',
        inline: true
      },
      {
        name: 'link',
        snippet: `{@link \${1:Element}}`,
        description: 'Link to another element. Prefer qualified name.',
        inline: true
      },
      {
        name: 'deprecated',
        snippet: `deprecated \${1:Version}`,
        description: 'Marks this element as deprecated. You can also use the [Version] attribute.'
      },
      {
        name: 'see',
        snippet: `see \${1:Element}`,
        description: 'Reference to a related element.'
      },
      {
        name: 'param',
        snippet: `param \${1:name} \${2:description}`,
        description: 'Description of a parameter'
      },
      {
        name: 'since',
        snippet: `since \${1:Version}`,
        description: 'Marks this element as available only since a certain version.'
      },
      {
        name: 'return',
        snippet: `return \${2:description}`,
        description: 'Describes what this element returns'
      },
      {
        name: 'throws',
        snippet: `throws \${1:GLib.Error} \${2:description}`,
        description: 'Describe the errors that could be thrown'
      }
    ]
  }

  getSuggestions ({editor, bufferPosition, scopeDescriptor, prefix}) {
    const line = editor.getTextInRange([[bufferPosition.row, 0], bufferPosition]).trim()
    const match = line.match(this.prefixRegex)
    prefix = match ? match[0] : prefix
    this.suggestions = []

    return new Promise(resolve => {
      if (prefix.startsWith('@')) {
        for (const taglet of this.taglets) {
          if (('@' + taglet.name).startsWith(prefix)) {
            if (line === '* ' + prefix || taglet.inline) {
              this.suggestions.push({
                type: 'keyword',
                description: taglet.description,
                iconHTML: '<i class="icon-mention"></i>',
                displayText: taglet.name,
                snippet: taglet.snippet
              })
            }
          }
        }
      }

      if (this.suggestions.length > 0) {
        this.excludeLowerPriority = true
      } else {
        this.excludeLowerPriority = false
      }

      resolve(this.suggestions)
    })
  }
}
