const CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function uuidToBase62(uuid: string): string {
    if (!uuid) return '';
    try {
        let hex = uuid.replace(/-/g, '');
        let num = BigInt('0x' + hex);
        let str = '';
        while (num > 0n) {
            let rem = num % 62n;
            str = CHARS[Number(rem)] + str;
            num = num / 62n;
        }
        return str;
    } catch (e) {
        return uuid;
    }
}

export function base62ToUuid(b62: string): string {
    if (!b62 || b62.length >= 30) return b62; // Already a UUID or invalid
    try {
        let num = 0n;
        for (let i = 0; i < b62.length; i++) {
            num = num * 62n + BigInt(CHARS.indexOf(b62[i]));
        }
        let hex = num.toString(16).padStart(32, '0');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    } catch (e) {
        return b62;
    }
}
