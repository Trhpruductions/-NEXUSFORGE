const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
    });
}

const targetDir = path.resolve(__dirname, '..', 'apps/web/src');
const regex = /rounded-(?!(none|0|\[0\]))[^ '"\s`]+/g;

walk(targetDir, (filePath) => {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        const content = fs.readFileSync(filePath, 'utf8');
        const newContent = content.replace(regex, 'rounded-none');
        if (content !== newContent) {
            console.log(`Hardening geometry: ${filePath}`);
            fs.writeFileSync(filePath, newContent, 'utf8');
        }
    }
});
