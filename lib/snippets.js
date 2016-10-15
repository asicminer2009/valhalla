'use babel';

export default [
    {
        name: 'GPL header',
        prefix: 'gpl',
        content:
`/*
* Copyright (c) 2011-2016 \${1:App} Developers (\${2:http://website.org/repo})
*
* This program is free software; you can redistribute it and/or
* modify it under the terms of the GNU General Public
* License as published by the Free Software Foundation; either
* version 2 of the License, or (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
* General Public License for more details.
*
* You should have received a copy of the GNU General Public
* License along with this program; if not, write to the
* Free Software Foundation, Inc., 59 Temple Place - Suite 330,
* Boston, MA 02111-1307, USA.
*
* Authored by: \${3:John Doe} <\${4:author@example.com}>
*/
`
    },
    {
        name: 'Valadoc comment',
        prefix: 'doc',
        content:
`/*
* \${1:Short description}
*
* \${2:Long description.}
*/`
    }
];
