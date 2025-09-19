// scripts/build-thai-address.js (CommonJS)
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

// ที่มา: thailand-geography-data/thailand-geography-json -> src/geography.json (MIT)
const SOURCE_URL = 'https://raw.githubusercontent.com/thailand-geography-data/thailand-geography-json/main/src/geography.json';

function download(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => resolve(raw));
      })
      .on('error', reject);
  });
}

function buildHierarchy(rows) {
  // rows: [{ provinceNameTh, districtNameTh, subdistrictNameTh, postalCode, ... }]
  const pMap = new Map();

  for (const r of rows) {
    const province = (r.provinceNameTh || '').trim();
    const amphoe = (r.districtNameTh || '').trim();
    const tambon = (r.subdistrictNameTh || '').trim();
    const zipcode = String(r.postalCode || '').padStart(5, '0');

    if (!province || !amphoe || !tambon) continue;

    if (!pMap.has(province)) pMap.set(province, new Map());
    const aMap = pMap.get(province);

    if (!aMap.has(amphoe)) aMap.set(amphoe, new Map());
    const tMap = aMap.get(amphoe);

    if (!tMap.has(tambon)) tMap.set(tambon, new Map());
    const zMap = tMap.get(tambon);

    if (!zMap.has(zipcode)) zMap.set(zipcode, 0);
    zMap.set(zipcode, zMap.get(zipcode) + 1);
  }

  const result = [];
  for (const [province, aMap] of pMap.entries()) {
    const amphoes = [];
    for (const [amphoe, tMap] of aMap.entries()) {
      const tambons = [];
      for (const [tambon, zMap] of tMap.entries()) {
        let bestZip = '';
        let bestCount = -1;
        for (const [zip, cnt] of zMap.entries()) {
          if (cnt > bestCount) { bestZip = zip; bestCount = cnt; }
        }
        tambons.push({ tambon, zipcode: bestZip });
      }
      tambons.sort((a, b) => a.tambon.localeCompare(b.tambon, 'th'));
      amphoes.push({ amphoe, tambons });
    }
    amphoes.sort((a, b) => a.amphoe.localeCompare(b.amphoe, 'th'));
    result.push({ province, amphoes });
  }
  result.sort((a, b) => a.province.localeCompare(b.province, 'th'));
  return result;
}

async function main() {
  console.log('→ ดาวน์โหลด geography.json ...');
  const raw = await download(SOURCE_URL);
  const geo = JSON.parse(raw);

  const data = buildHierarchy(geo);

  const outDir = path.join(process.cwd(), 'public');
  const outFile = path.join(outDir, 'thai-address.json');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2), 'utf8');

  console.log(`✅ สร้างไฟล์สำเร็จ: ${outFile}`);
}

main().catch((e) => {
  console.error('✗ Error:', e);
  process.exit(1);
});
