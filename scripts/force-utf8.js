const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
    });
}

function isUtf8(buf) {
    try {
        new TextDecoder('utf-8', { fatal: true }).decode(buf);
        return true;
    } catch (e) {
        return false;
    }
}

const targetDir = path.resolve(__dirname, '..', 'apps/web/src');

walk(targetDir, (filePath) => {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        const buf = fs.readFileSync(filePath);
        if (!isUtf8(buf)) {
            console.log(`Converting to UTF-8: ${filePath}`);
            const latin1 = buf.toString('latin1');
            fs.writeFileSync(filePath, latin1, 'utf8');
        }
    }
});
