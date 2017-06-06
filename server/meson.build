project('Completer', 'vala', 'c')

vala_version = meson.get_compiler('vala').version().split('.')

glib = dependency('glib-2.0')
gobject = dependency('gobject-2.0')
json = dependency('json-glib-1.0')
gee = dependency('gee-0.8')
libvala = dependency('libvala-@0@.@1@'.format(vala_version[0], vala_version[1]))
soup = dependency('libsoup-2.4')

executable('completer',
  'src/json-ast.vala',
  'src/main.vala',
  'src/report.vala',
  'src/report-message.vala',
  dependencies : [glib, gobject, json, gee, libvala, soup]
)
