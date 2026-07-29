#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CONFIG = {
  input: process.argv[2] || 'excel/results.xlsx',
  outputDir: 'data',
  chunkSize: 5000,
  passThreshold: 50,
  compress: process.argv.includes('--compress')
};

const norm = (s) => (s||'').toString().trim().replace(/\s+/g,' ').toLowerCase().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');
const fmtNum = (n) => (n||0).toLocaleString('ar-EG');
function log(msg, type='INFO') {
  const colors = { INFO:'\x1b[36m', OK:'\x1b[32m', WARN:'\x1b[33m', ERR:'\x1b[31m' };
  console.log(`${colors[type]}[${type}]\x1b[0m ${msg}`);
}

function findKey(keys, candidates) {
  for (const k of keys) {
    const nk = norm(k);
    for (const c of candidates) if (nk.includes(norm(c))) return k;
  }
  return null;
}

function guessMax(val, key) {
  const k = norm(key);
  if (k.includes('عربي') || k.includes('لغه اول')) return 80;
  if (k.includes('لغه تانيه') || k.includes('لغة ثانية')) return 40;
  if (k.includes('دين') || k.includes('تربيه') || k.includes('وطني')) return 60;
  if (k.includes('فلسفه') || k.includes('نفسي') || k.includes('منطق')) return 60;
  if (k.includes('جغراف') || k.includes('تاريخ')) return 60;
  if (k.includes('احياء') || k.includes('جيولوج')) return 60;
  if (k.includes('فيزياء') || k.includes('كيمياء')) return 60;
  if (k.includes('رياضه') || k.includes('رياضيات')) return 60;
  return 100;
}

function main() {
  const startTime = Date.now();
  log('🚀 بدء بناء ملفات DAMA...');
  
  if (!existsSync(CONFIG.input)) {
    log(`ملف ${CONFIG.input} غير موجود!`, 'ERR');
    process.exit(1);
  }
  
  log(`📖 قراءة ${CONFIG.input}...`);
  const fileBuffer = readFileSync(CONFIG.input);
  const wb = XLSX.read(fileBuffer, { type:'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval:'' });
  
  if (!rows.length) { log('الملف فارغ!', 'ERR'); process.exit(1); }
  log(`✅ تم قراءة ${fmtNum(rows.length)} صف`, 'OK');
  
  const keys = Object.keys(rows[0]);
  const map = {
    seat: findKey(keys, ['seat','جلوس','رقم الجلوس','رقم']),
    name: findKey(keys, ['name','اسم','الاسم']),
    school: findKey(keys, ['school','مدرسة','المدرسة']),
    governorate: findKey(keys, ['governorate','محافظة','المحافظة']),
    administration: findKey(keys, ['administration','ادارة','الإدارة']),
    division: findKey(keys, ['division','شعبة','قسم']),
    status: findKey(keys, ['status','حالة','الحالة'])
  };
  
  const usedKeys = new Set(Object.values(map).filter(Boolean));
  const subjectKeys = keys.filter(k => !usedKeys.has(k) && !/^\s*$/.test(String(rows[0][k])));
  const subjectsMeta = subjectKeys.map(k => ({ key:k, name:k, max:guessMax(rows[0][k], k) }));
  log(`📚 تم اكتشاف ${subjectsMeta.length} مادة`, 'INFO');
  
  log('⚙️ معالجة الطلاب...');
  const students = [];
  const seenSeats = new Set();
  
  rows.forEach((r, i) => {
    const seat = String(r[map.seat]||'').trim();
    const name = String(r[map.name]||'').trim();
    if (!seat || !name || seenSeats.has(seat)) return;
    seenSeats.add(seat);
    
    const subjects = subjectsMeta.map(m => ({ name:m.name, score:Number(r[m.key])||0, max:m.max }));
    const total = subjects.reduce((a,b) => a+(Number(b.score)||0), 0);
    const maxTotal = subjects.reduce((a,b) => a+(Number(b.max)||0), 0);
    
    students.push({
      seat, name,
      school: String(r[map.school]||'').trim(),
      governorate: String(r[map.governorate]||'').trim(),
      administration: String(r[map.administration]||'').trim(),
      division: String(r[map.division]||'').trim(),
      status: String(r[map.status]||'').trim() || (maxTotal ? (total/maxTotal*100 >= CONFIG.passThreshold ? 'ناجح' : 'راسب') : '—'),
      total, maxTotal, subjects
    });
    
    if ((i+1) % 100000 === 0) log(`  📊 ${fmtNum(i+1)} / ${fmtNum(rows.length)}`);
  });
  
  log(`✅ تمت معالجة ${fmtNum(students.length)} طالب`, 'OK');
  mkdirSync(CONFIG.outputDir, { recursive: true });
  
  const index = {};
  for (let i = 0; i < students.length; i += CONFIG.chunkSize) {
    const slice = students.slice(i, i + CONFIG.chunkSize);
    const idx = String(Math.floor(i / CONFIG.chunkSize) + 1).padStart(3, '0');
    const fname = `chunk-${idx}.json`;
    slice.forEach(s => { index[s.seat] = fname; });
    writeFileSync(resolve(CONFIG.outputDir, fname), JSON.stringify(slice));
  }
  
  writeFileSync(resolve(CONFIG.outputDir, 'index.json'), JSON.stringify(CONFIG.compress ? index : index));
  
  const success = students.filter(s => s.status === 'ناجح').length;
  const failed = students.length - success;
  
  const govMap = {};
  students.forEach(s => {
    if (!s.governorate) return;
    if (!govMap[s.governorate]) govMap[s.governorate] = { total:0, count:0 };
    govMap[s.governorate].total += s.total;
    govMap[s.governorate].count++;
  });
  const topGovs = Object.entries(govMap).map(([name,v]) => ({ name, value:Math.round(v.total/v.count) })).sort((a,b) => b.value-a.value).slice(0,27);
  
  const schMap = {};
  students.forEach(s => {
    if (!s.school) return;
    if (!schMap[s.school]) schMap[s.school] = { total:0, count:0 };
    schMap[s.school].total += s.total;
    schMap[s.school].count++;
  });
  const topSchools = Object.entries(schMap).map(([name,v]) => ({ name, value:Math.round(v.total/v.count) })).sort((a,b) => b.value-a.value).slice(0,50);
  
  const stats = { total:students.length, success, failed, topGovs, topSchools };
  writeFileSync(resolve(CONFIG.outputDir, 'stats.json'), JSON.stringify(stats, null, 2));
  
  const sorted = [...students].sort((a,b) => b.total - a.total);
  const byGov = {};
  students.forEach(s => {
    if (!s.governorate) return;
    if (!byGov[s.governorate]) byGov[s.governorate] = [];
    byGov[s.governorate].push(s);
  });
  Object.keys(byGov).forEach(g => { byGov[g] = byGov[g].sort((a,b) => b.total-a.total).slice(0,10); });
  
  writeFileSync(resolve(CONFIG.outputDir, 'top.json'), JSON.stringify({ top100:sorted.slice(0,100), top500:sorted.slice(0,500), byGov }));
  
  const newsPath = resolve(CONFIG.outputDir, 'news.json');
  if (!existsSync(newsPath)) {
    writeFileSync(newsPath, JSON.stringify([
      { date:'2026-07-29', title:'اعتماد نتائج الثانوية العامة', text:'تم اعتماد النتائج رسمياً.' },
      { date:'2026-07-28', title:'إطلاق منصة DAMA', text:'يسعدنا إطلاق منصة DAMA.' }
    ], null, 2));
  }
  
  const settingsPath = resolve(CONFIG.outputDir, 'settings.json');
  if (!existsSync(settingsPath)) {
    writeFileSync(settingsPath, JSON.stringify({ maintenance:false, announcement:'', password:'dama2026' }, null, 2));
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n' + '='.repeat(60));
  log(`🎉 تم البناء في ${elapsed} ثانية`, 'OK');
  log(`📊 إجمالي: ${fmtNum(students.length)} | ✅ ناجح: ${fmtNum(success)} | ❌ راسب: ${fmtNum(failed)}`, 'OK');
  console.log('='.repeat(60));
}

main();