const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        filelist = walkSync(dirFile, filelist);
      }
    } else {
      if (dirFile.endsWith('.tsx') || dirFile.endsWith('.ts') || dirFile.endsWith('.html') || dirFile.endsWith('.css')) {
        filelist.push(dirFile);
      }
    }
  });
  return filelist;
};

const files = walkSync('.');

let modifiedFiles = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  let newContent = content;

  // Visual/Classes
  newContent = newContent.replace(/bg-gradient-kiwi\s+hover:opacity-90/g, '');
  newContent = newContent.replace(/bg-gradient-kiwi/g, '');
  newContent = newContent.replace(/shadow-kiwi/g, 'shadow-sm');
  
  // Brand Names
  newContent = newContent.replace(/KiwiFlow/g, 'Simply');
  newContent = newContent.replace(/KiwiApp/g, 'Simply');
  newContent = newContent.replace(/Kiwi/g, 'Simply');
  newContent = newContent.replace(/kiwi/g, 'simply');
  
  // Typography
  newContent = newContent.replace(/Manrope/g, 'Inter');

  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf8');
    modifiedFiles++;
    console.log(`Modified ${file}`);
  }
});

console.log(`Successfully modified ${modifiedFiles} files.`);
