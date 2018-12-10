import { ArgumentParser } from 'argparse';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import dateFormat from 'dateformat';
import { spawn } from 'node-pty';

class BTTrackerCache {
    _dir = (() => {
        if (process.env['BTL_CACHE']) {
            return process.env['BTL_CACHE'];
        } else if (process.platform == 'win32') {
            let appData = process.env['APPDATA'];
            return path.join(appData, 'btl-cache');
        } else {
            return `${process.env['HOME']}/.btl-cache`;
        }
    })();

    _uri = 'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best_ip.txt';

    constructor() {
        if (!fs.existsSync(this._dir))
            fs.mkdirSync(this._dir);
    }

    async downloadTrackerList(currentDate: string, 
                              separator: string = ',') {
        return new Promise(resolve => {
            https.get(this._uri, (res) => {
                res.on('data', (d: Buffer) => {
                    const list = d.toString().split('\n')
                        .filter(s => s != '')
                        .join(separator);
                    if (!currentDate) {
                        currentDate = dateFormat(new Date(), 'yyyyMMdd');
                    }
                    const currentFile = path.join(this._dir, `btl-${currentDate}.txt`);
                    fs.writeFileSync(currentFile, list);
                    resolve();         
                });
            });
        });
    }

    async getTrackerList(update: boolean = false) {
        const currentDate = dateFormat(new Date(), 'yyyyMMdd');
        const currentFile = path.join(this._dir, `btl-${currentDate}.txt`);
        if (!fs.existsSync(currentFile) || update) {
            console.log("update tracker list");
            await this.downloadTrackerList(currentDate);
        }
        return fs.readFileSync(currentFile, "utf-8");
    }
}

let parser = new ArgumentParser();
parser.addArgument(['-u', '--update-trackers'], {nargs: 0});

let args = parser.parseKnownArgs();
console.log(args);

new BTTrackerCache().getTrackerList(args[0].update_trackers).then(
    btList => {
        const cmd = ['aria2c', `--bt-tracker=${btList}`, ...args[1]].join(' ');
        console.log(cmd);
        const ps = spawn('aria2c', [`--bt-tracker=${btList}`, ...args[1]], {});
        ps.on('data', function(data) {
            console.log(data);
        });
    }
);

