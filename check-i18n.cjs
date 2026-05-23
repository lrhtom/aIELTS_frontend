const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const translationsFile = path.join(srcDir, 'i18n', 'translations.ts');

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];
    files.forEach(function(file) {
        if (fs.statSync(dirPath + '/' + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + '/' + file, arrayOfFiles);
        } else {
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                arrayOfFiles.push(path.join(dirPath, file));
            }
        }
    });
    return arrayOfFiles;
}

const allFiles = getAllFiles(srcDir).filter(f => !f.includes('translations'));

let allKeys = new Set();
const regex = /\bt\.([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)/g;

allFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = regex.exec(content)) !== null) {
        // Discard keys that end with methods like map, length, replace, etc.
        let key = match[1];
        if (key.endsWith('.map') || key.endsWith('.length') || key.endsWith('.replace') || key.endsWith('.forEach') || key.endsWith('.join') || key.endsWith('.filter') || key.endsWith('.slice') || key.endsWith('.split')) {
            key = key.substring(0, key.lastIndexOf('.'));
        }
        allKeys.add(key);
    }
});

const translationsContent = fs.readFileSync(translationsFile, 'utf8');
const missingKeys = [];

allKeys.forEach(key => {
    const parts = key.split('.');
    
    // Check if the exact final leaf property exists in the translations.ts file
    // Note: translations.ts is an interface definition, so it should have something like `propertyName: string;` or similar
    const leaf = parts[parts.length - 1];
    
    // Basic heuristics: if the translation file doesn't contain the leaf name followed by a colon or question mark
    if (!translationsContent.includes(leaf + ':') && !translationsContent.includes(leaf + '?:')) {
        missingKeys.push(key);
    }
});

console.log('Potentially missing keys:', missingKeys.sort());
