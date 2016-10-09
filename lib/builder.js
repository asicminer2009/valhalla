'use babel';

import * as fs from 'fs';
import * as path from 'path';

export default class ValacBuilder {
    constructor (cwd) {
        console.log('valac builder');
        this.errMatch =  '(?<file>[\\/\\w\\.]+):(?<line>\\d+).(?<col>\\d+)(-(?<line_end>\\d+).(?<col_end>\\d+))?:\\s+error:\\s+(?<message>.+)';
        this.warnMatch = '(?<file>[\\/\\w\\.]+):(?<line>\\d+).(?<col>\\d+)(-(?<line_end>\\d+).(?<col_end>\\d+))?:\\s+warning:\\s+(?<message>.+)';
        this.cwd = cwd;
        this.buildType = 'vanilla';
        this.dirs = new Set([]);
    }

    getNiceName() {
        return 'Vala builder';
    }

    isEligible() {
        // REQUIRED: Perform operations to determine if this build provider can
        // build the project in `cwd` (which was specified in `constructor`).
        let foundValaFile = false;
        const explore = (dir) => {
            files = fs.readdirSync(dir);
            for (const file of files) {

                if (fs.statSync(path.join(dir, file)).isDirectory()) {
                    explore (path.join(dir, file));
                }

                if (file.endsWith('.vala')) {
                    this.dirs.add(dir);
                    foundValaFile = true;
                }

                if (file.endsWith('.vproj.in') || file.endsWith('.vproj')) {
                    this.manfifestPath = file;
                    this.buildType = 'vproj';
                }

                if (file == 'poulp.json') {
                    this.buildType = 'poulp';
                }
            }
        }
        explore(this.cwd);

        return foundValaFile;
    }

    settings() {
        const builders = [];
        switch (this.buildType) {
            case 'poulp':
                builders.push({
                    cmd: 'poulp',
                    name: 'poulp',
                    args: ['build'],
                    errorMatch: this.errMatch,
                    warningMatch: this.warnMatch
                });
                break;
            case 'vproj':
                const manifest = JSON.parse(fs.readFileSync(path.join(this.cwd, this.manifestPath)));
                const args = [];
                args.push('-o');
                args.push(manifest.name + '-' + manifest.version)
                for (const pkg of manifest.packages) {
                    args.push('--pkg');
                    args.push(pkg);
                }
                for (const prop of manfifest.flags) {
                    args.push ('--' + prop);
                    args.push(manfifest.flags[prop]);
                }
                builders.push({
                    cmd: 'valac',
                    name: 'Vproj',
                    args: args,
                    errorMatch: this.errMatch,
                    warningMatch: this.warnMatch
                });
                break;
            case 'vanilla': // just use valac
            default:
            const customArgs = atom.config.get('valhalla.valacArgs');
                builders.push({
                    exec: 'valac',
                    name: 'Vanilla valac',
                    args: customArgs ? customArgs : [...this.dirs].map((dir) => {
                        return path.join(dir, '*.vala');
                    }), // TODO : make it smarter
                    errorMatch: this.errMatch,
                    warningMatch: this.warnMatch
                });
                break;
        }
        console.log(builders);
        return builders;
    }

    on(event, cb) {
        // OPTIONAL: The build provider can let `build` know when it is time to
        // refresh targets.
        return 'void';
    }

    removeAllListeners(event) {
        // OPTIONAL: (required if `on` is defined) removes all listeners registered in `on`
        return 'void';
    }
}
