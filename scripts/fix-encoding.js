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

walk(targetDir, (filePath) => {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        let content = fs.readFileSync(filePath); // read as buffer
        // Look for EF BF BD (REPLACEMENT CHARACTER in UTF-8)
        const corrupted = Buffer.from([0xEF, 0xBF, 0xBD]);
        if (content.indexOf(corrupted) !== -1) {
            console.log(`Fixing encoding corruption: ${filePath}`);
            let text = content.toString('utf8');
            // Specific patches for identified corrupted symbols
            text = text.replace(/\ufffd/g, (match, offset, str) => {
                // Heuristic: if near "temp", it's probably degree
                const context = str.substring(offset - 10, offset + 10);
                if (context.includes('temp')) return '°';
                // if near "2026", it's probably copyright
                if (context.includes('2026')) return '©';
                // default to empty or space if unknown? 
                // Actually, let's just use what makes sense in a tech UI.
                return ''; 
            });
            fs.writeFileSync(filePath, text, 'utf8');
        }
    }
});
