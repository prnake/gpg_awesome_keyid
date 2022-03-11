/**
 * 返回true则发送通知（并自动保存到数据库）
 * @param {string} fingerprint 公钥指纹
 */
function notify (fingerprint) {
    return 1 === new Set(fingerprint.slice(32)).size;
}

/**
 * 返回true则将fingerprint对应的key保存到数据库
 * @param {string} fingerprint 公钥指纹
 */
function save (fingerprint) {
    const special_list = [
        '01234567',
        '76543210',
        'abcdef',
        '12345678',
        '87654321',
        'aaaacccc',
    ];
    if (new Set(fingerprint.slice(32)).size == 1
        || new Set(fingerprint.slice(24)).size <= 2
        || new Set(fingerprint).size <= 4) {
        return true;
    }
    for (let s of special_list) {
        if (fingerprint.endsWith(s)) {
            return true;
        }
    }
    return false;
}

export { notify };
export { save };
export default {
    notify,
    save
};
