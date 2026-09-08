import fs from 'node:fs';

const file = process.argv[2] || 'artifacts/ui_activity_real.xml';
if (!fs.existsSync(file)) {
  console.log('File not found:', file);
  process.exit(1);
}
const content = fs.readFileSync(file, 'utf8');
const regex =
  /<node\b[^>]*class="([^"]*)"[^>]*content-desc="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g;
for (const match of content.matchAll(regex)) {
  const cls = match[1];
  const desc = match[2].replace(/&#10;/g, ' ').replace(/&amp;/g, '&').trim();
  if (desc) {
    console.log(`[${match[3]},${match[4]} - ${match[5]},${match[6]}] (${cls}) ${desc}`);
  }
}
