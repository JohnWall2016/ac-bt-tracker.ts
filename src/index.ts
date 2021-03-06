import { ArgumentParser } from 'argparse';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import dateFormat from 'dateformat';
import { spawn } from 'node-pty';

class BTTrackerCache {
    _cachedDir = (() => {
        if (process.env['BTL_CACHE']) {
            return process.env['BTL_CACHE'];
        } else if (process.platform == 'win32') {
            let appData = process.env['APPDATA'];
            return path.join(appData, 'btl-cache');
        } else {
            return `${process.env['HOME']}/.btl-cache`;
        }
    })();

    get _cachedFile(): string {
        const currentDate = dateFormat(new Date(), 'yyyymmdd');
        return path.join(this._cachedDir, `btl-${currentDate}.txt`);
    }

    _uri = 'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best_ip.txt';

    constructor() {
        if (!fs.existsSync(this._cachedDir))
            fs.mkdirSync(this._cachedDir);
    }

    async downloadTrackerList(separator: string = ',') {
        return new Promise<string>(resolve => {
            https.get(this._uri, (res) => {
                res.on('data', (d: Buffer) => {
                    const list = d.toString().split('\n')
                        .filter(s => s != '')
                        .join(separator);
                    fs.writeFileSync(this._cachedFile, list);
                    resolve(list);
                });
            });
        });
    }

    async getTrackerList(update: boolean = false) {
        if (!fs.existsSync(this._cachedFile) || update) {
            console.log("update tracker list");
            return await this.downloadTrackerList();
        }
        return fs.readFileSync(this._cachedFile, "utf-8");
    }
}

let parser = new ArgumentParser();
parser.addArgument(['-u', '--update-trackers'], { nargs: 0,
    help: `update tracker list` });
parser.addArgument(['-m', '--move-to'], { nargs: 1,
    help: `move from src dir to dest dir` });
parser.addArgument(['-mx', '--move-to-exclude'], { nargs: 1,
        help: `the files matched by this regex will not be moved` });

let args = parser.parseKnownArgs();
console.log(args);

if (args[0].move_to) {
    let srcDirs = <string[]>args[1];
    let outDir = args[0].move_to[0];
    let exclude = args[0].move_to_exclude;

    let msg = `move files from ${srcDirs} to ${outDir}`;
    if (exclude) msg += ` excluding ${exclude}`;
    console.log(msg);

    if (srcDirs && outDir) {
        srcDirs.forEach(dir => move(dir, outDir));
    }

    function move(srcDir: string, outDir: string, extFilter: RegExp = /\.(mp4|mkv)$/i) {
        fs.readdir(srcDir, (err, files) => {
            if (err) {
                console.error(err.message);
                process.exit(-1);
            }
            files.forEach(f => {
                if (!exclude || !f.match(new RegExp(exclude))) {
                    let file = path.join(srcDir, f);
                    if (fs.lstatSync(file).isDirectory()) {
                            move(file, outDir);
                    } else {
                        let m = file.match(extFilter);
                        if (m) {
                            f = f.replace(/^\[.+\]/, '');
                            let outFile = path.join(outDir, f.slice(0, f.length - 1));
                            console.log(`move ${file} to ${outFile}`);
                            fs.renameSync(file, outFile);
                        }
                    }
                }
            })
        });
    }
} else {
    new BTTrackerCache().getTrackerList(args[0].update_trackers).then(
        btList => {
            let aria2c = 'aria2c';
            if (process.platform == 'win32')
                aria2c = 'aria2c.exe'
            const cmd = [aria2c, `--bt-tracker=${btList}`, ...args[1]].join(' ');
            console.log(cmd);
            const ps = spawn(aria2c, [`--bt-tracker=${btList}`, ...args[1]], {});
            ps.on('data', function (data) {
                console.log(data);
            });
        }
    );
}
