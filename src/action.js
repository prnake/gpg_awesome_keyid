import sqlite3 from 'sqlite3';
import * as sqlite from 'sqlite';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fork } from 'child_process';
import got from 'got';
import gpg from 'gpg';
import util from 'util';
import rule from './rule.js';
import openpgp from 'openpgp';
const gpg_import = util.promisify(gpg.importKey);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbs_path = join(__dirname, '../dbs');

async function gen_basic_key () {
    const { privateKey, publicKey, revocationCertificate } = await openpgp.generateKey({
        type   : 'ecc',
        curve  : 'curve25519',
        userIDs: [{ name: 't' }]
    });
    return await openpgp.readPrivateKey({ armoredKey: privateKey });
}

async function notify_with_url (url, fingerprint) {
    if (url != 'undefined') {
        await got.get(`${url}${fingerprint}`);
    }
}

async function do_generate (db_path, url) {
    let db = await sqlite.open({
        filename: db_path,
        driver  : sqlite3.Database
    });
    await db.run(`create table if not exists key(
        fpr text not null,
        key text not null
    )`);
    let prikey = null;
    let start = new Date();
    for (let index = 0;; index++) {
        if (0 === index % 10000) {
            prikey = await gen_basic_key();
            const time_shift = (new Date() - start) / 1000;
            const count = (await db.get('select count(*) from key'))['count(*)'];
            console.log(`[${db_path}] 耗时${time_shift}秒，已计算key${index}个，数据库中已保存${count}个key`);
        }
        // 修改key的创建时间并重新计算指纹
        // ! 需要注意的是，此时的key的subkey和uid的签名都是需要修正的，是原始指纹的key的签名
        prikey.keyPacket.created = new Date(prikey.keyPacket.created.getTime() - 1000);
        await prikey.keyPacket.computeFingerprint();
        let r = {
            fpr: prikey.getFingerprint(),
            key: prikey.armor()
        };
        // 仅保存或发送提醒
        const save = rule.save(r.fpr);
        const notify = rule.notify(r.fpr);
        if (save || notify) {
            await (await db.prepare('insert into key(fpr,key) values(?,?)')).run(r.fpr, r.key);
        }
        if (notify) {
            await notify_with_url(url, r.fpr);
        }
    }
}

function list (suffix, cb) {
    fs.readdir(dbs_path, function (err, files) {
        if (err) {
            console.warn(err);
            return;
        }
        files.forEach(async (dbname) => {
            let db_path = join(dbs_path, dbname);
            if (!db_path.endsWith('.db')) {
                return;
            }
            let db = await sqlite.open({
                filename: db_path,
                driver  : sqlite3.Database
            });
            db.each('select * from key', (e, k) => {
                let keyid = k.fpr.slice(24);
                if ((suffix && k.fpr.toLowerCase().endsWith(suffix.toLowerCase()))
                    ||
                        !suffix) {
                    if (cb) {
                        cb(k.key);
                    }
                    else {
                        console.log(`${k.fpr} => ${keyid.slice(0, 4)} ${keyid.slice(4, 8)} ${keyid.slice(8, 12)} ${keyid.slice(12, 16)}`);
                    }
                }
            });
        });
    });
}

function _import (suffix, uid = { name: undefined, email: undefined, comment: undefined }) {
    console.error(`注意：导入的key并未设置密码，请自行使用命令设置密码，数据库中存在明文key，记得删除，防止泄漏
gpg --edit-key <keyid>
passwd
`);
    list(suffix, async (key) => {
        let prikey = await openpgp.readKey({ armoredKey: key });
        let nk = await openpgp.reformatKey({ privateKey: prikey, userIDs: [uid] });
        await gpg_import(nk.privateKey);
        console.log(`已导入key[${prikey.getFingerprint()}]`);
    });
}

function generate (process, url) {
    try {
        fs.mkdirSync(dbs_path);
    }
    catch (e) { }
    const process_count = process;
    for (let i = 0; i < process_count; i++) {
        fork(__filename, [join(dbs_path, `key${i}.db`), url]);
    }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
    (async () => {
        await do_generate(process.argv[2], process.argv[3]);
    })();
}
export { generate };
export { list };
export { _import as import };
export default {
    generate,
    list,
    import: _import
};
