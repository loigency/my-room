const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIR = 'assets/images/photography';
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.png'));

(async () => {
  for (const f of files) {
    const input = path.join(DIR, f);
    const output = input.replace('.png', '.webp');
    const info = await sharp(input)
      .webp({ quality: 85 })
      .toFile(output);
    const orig = fs.statSync(input).size;
    const comp = fs.statSync(output).size;
    console.log(`${f}: ${(orig/1024).toFixed(0)}KB → ${(comp/1024).toFixed(0)}KB (${(100-comp/orig*100).toFixed(0)}% smaller)`);
  }
  console.log('Done!');
})();
