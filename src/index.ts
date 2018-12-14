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
        return new Promise(resolve => {
            https.get(this._uri, (res) => {
                res.on('data', (d: Buffer) => {
                    const list = d.toString().split('\n')
                        .filter(s => s != '')
                        .join(separator);
                    fs.writeFileSync(this._cachedFile, list);
                    resolve();
                });
            });
        });
    }

    async getTrackerList(update: boolean = false) {
        if (!fs.existsSync(this._cachedFile) || update) {
            console.log("update tracker list");
            await this.downloadTrackerList();
        }
        return fs.readFileSync(this._cachedFile, "utf-8");
    }
}

let parser = new ArgumentParser();
parser.addArgument(['-u', '--update-trackers'], {nargs: 0});

let args = parser.parseKnownArgs();
console.log(args);

new BTTrackerCache().getTrackerList(args[0].update_trackers).then(
    btList => {
        let aria2c = 'aria2c';
        if (process.platform == 'win32')
            aria2c = 'aria2c.exe'
        const cmd = [aria2c, `--bt-tracker=${btList}`, ...args[1]].join(' ');
        console.log(cmd);
        const ps = spawn(aria2c, [`--bt-tracker=${btList}`, ...args[1]], {});
        ps.on('data', function(data) {
            console.log(data);
        });
    }
);

