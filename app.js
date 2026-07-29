'use strict';
const CONFIG={appName:'نتيجة الثانوية العامة من DAMA',year:'2025 / 2026',adminPasswordDefault:'dama2026',chunkSize:5000,passThreshold:50,dataPath:'data/',indexFile:'data/index.json',statsFile:'data/stats.json',topFile:'data/top.json',newsFile:'data/news.json',settingsFile:'data/settings.json'};
const State={theme:localStorage.getItem('dama_theme')||'light',index:null,stats:null,top:null,news:[],settings:{maintenance:false,announcement:'',password:CONFIG.adminPasswordDefault},currentStudent:null,searchMode:'seat',searchCache:new Map(),counters:{visitors:parseInt(localStorage.getItem('dama_visitors')||'0'),searches:parseInt(localStorage.getItem('dama_searches')||'0')},adminAuthed:false,adminData:null};
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const norm=(s)=>(s||'').toString().trim().replace(/\s+/g,' ').toLowerCase().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');
const fmtNum=(n)=>(n||0).toLocaleString('ar-EG');
function toast(msg,type=''){const t=$('#toast');t.textContent=msg;t.className='toast '+type;setTimeout(()=>t.classList.add('hidden'),2800)}
function applyTheme(){document.documentElement.setAttribute('data-theme',State.theme);const icon=$('#themeToggle i');if(icon)icon.className=State.theme==='dark'?'fas fa-sun':'fas fa-moon'}
function toggleTheme(){State.theme=State.theme==='dark'?'light':'dark';localStorage.setItem('dama_theme',State.theme);applyTheme()}
function navigate(route){const valid=['home','result','stats','top','news','404'];if(!valid.includes(route))route='404';$$('.page').forEach(p=>p.classList.remove('active'));const page=$(`#page-${route}`);if(page)page.classList.add('active');$$('.nav-links a').forEach(a=>a.classList.toggle('active',a.dataset.route===route));window.scrollTo({top:0,behavior:'smooth'});location.hash=route==='home'?'':route}
function handleRoute(){const hash=location.hash.replace('#','').trim();if(!hash)return navigate('home');if(hash.startsWith('result/')){const seat=decodeURIComponent(hash.split('/')[1]);searchBySeat(seat);return}navigate(hash)}
async function loadJSON(url){try{const r=await fetch(url+'?t='+Date.now(),{cache:'no-cache'});if(!r.ok)return null;return await r.json()}catch(e){return null}}
async function loadData(){const[index,stats,top,news,settings]=await Promise.all([loadJSON(CONFIG.indexFile),loadJSON(CONFIG.statsFile),loadJSON(CONFIG.topFile),loadJSON(CONFIG.newsFile),loadJSON(CONFIG.settingsFile)]);State.index=index||{};State.stats=stats||{total:0,success:0,failed:0,topGovs:[],topSchools:[]};State.top=top||{top100:[],top500:[],byGov:{}};State.news=news||defaultNews();State.settings=settings||{maintenance:false,announcement:'',password:CONFIG.adminPasswordDefault}}
function defaultNews(){return[{date:'2026-07-29',title:'اعتماد نتائج الثانوية العامة',text:'تم اعتماد النتائج رسمياً ويمكن الآن الاستعلام عنها.'},{date:'2026-07-28',title:'إطلاق منصة DAMA',text:'يسعدنا إطلاق منصة DAMA لعرض نتائج الثانوية العامة.'}]}
function renderHome(){const s=State.stats;animateNumber($('#statStudents'),s.total);animateNumber($('#statSuccess'),s.success);animateNumber($('#statFailed'),s.failed);const rate=s.total?((s.success/s.total)*100).toFixed(1):0;$('#statPercent').textContent=rate+'%';$('#newsSlider').innerHTML=State.news.slice(0,6).map(n=>`<article class="news-card glass"><div class="date"><i class="fas fa-calendar"></i> ${n.date}</div><h3>${escapeHTML(n.title)}</h3><p>${escapeHTML(n.text)}</p></article>`).join('');$('#newsList').innerHTML=State.news.map(n=>`<article class="news-card glass"><div class="date"><i class="fas fa-calendar"></i> ${n.date}</div><h3>${escapeHTML(n.title)}</h3><p>${escapeHTML(n.text)}</p></article>`).join('')||'<p class="info-box">لا توجد أخبار.</p>'}
function animateNumber(el,target){if(!el)return;const dur=1200;const start=performance.now();function step(now){const p=Math.min(1,(now-start)/dur);const eased=1-Math.pow(1-p,3);el.textContent=fmtNum(Math.floor(target*eased));if(p<1)requestAnimationFrame(step)}requestAnimationFrame(step)}
function escapeHTML(s){return(s||'').toString().replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function searchBySeat(seat){seat=(seat||'').toString().trim();if(!seat){toast('أدخل رقم الجلوس','error');return}if(!State.index||!Object.keys(State.index).length){toast('البيانات غير متاحة','error');return}const chunk=State.index[seat];if(!chunk){toast('رقم الجلوس غير موجود','error');return}let data=State.searchCache.get(chunk);if(!data){data=await loadJSON(CONFIG.dataPath+chunk);if(data)State.searchCache.set(chunk,data)}if(!data){toast('خطأ في تحميل البيانات','error');return}const student=data.find(s=>String(s.seat)===seat);if(!student){toast('لم يتم العثور على الطالب','error');return}State.counters.searches++;localStorage.setItem('dama_searches',State.counters.searches);$('#searchCount').textContent=fmtNum(State.counters.searches);State.currentStudent=student;renderResult(student);navigate('result');location.hash='result/'+encodeURIComponent(seat)}
async function searchByName(name){name=norm(name);if(!name||name.length<3){toast('أدخل 3 أحرف على الأقل','error');return}if(!State.index||!Object.keys(State.index).length){toast('البيانات غير متاحة','error');return}const chunks=[...new Set(Object.values(State.index))];const results=[];for(const c of chunks){let data=State.searchCache.get(c);if(!data){data=await loadJSON(CONFIG.dataPath+c);if(data)State.searchCache.set(c,data)}if(!data)continue;for(const s of data){if(norm(s.name).includes(name)){results.push(s);if(results.length>=20)break}}if(results.length>=20)break}if(!results.length){toast('لا توجد نتائج','error');return}showSuggestions(results,true)}
function showSuggestions(items){const box=$('#suggestions');box.innerHTML=items.map(s=>`<div class="item" data-seat="${s.seat}"><span><strong>${escapeHTML(s.name)}</strong></span><small>جلوس: ${s.seat} | ${escapeHTML(s.governorate||'')}</small></div>`).join('');box.classList.remove('hidden');$$('.item',box).forEach(el=>{el.onclick=()=>{box.classList.add('hidden');$('#searchInput').value=el.dataset.seat;searchBySeat(el.dataset.seat)}})}
function renderResult(s){$('#rName').textContent=s.name||'—';$('#rSeat').textContent=s.seat||'—';$('#rSchool').textContent=s.school||'—';$('#rGov').textContent=s.governorate||'—';$('#rAdmin').textContent=s.administration||'—';$('#rDiv').textContent=s.division||'—';$('#studentAvatar').textContent=(s.name||'ط').charAt(0);const total=Number(s.total)||0;const max=Number(s.maxTotal)||410;const percent=max?((total/max)*100).toFixed(2):0;const status=percent>=CONFIG.passThreshold?'ناجح':'راسب';$('#rStatus').textContent=status;$('#rStatus').style.color=status==='ناجح'?'var(--green)':'var(--red)';$('#rTotal').textContent=fmtNum(total)+' / '+fmtNum(max);$('#rPercent').textContent=percent+'%';const subjects=s.subjects||[];const tbody=$('#rSubjects');tbody.innerHTML=subjects.map(sub=>{const sc=Number(sub.score)||0;const mx=Number(sub.max)||100;const p=mx?((sc/mx)*100).toFixed(1):0;return`<tr><td>${escapeHTML(sub.name)}</td><td>${fmtNum(sc)}</td><td>${fmtNum(mx)}</td><td>${p}%</td></tr>`}).join('')||'<tr><td colspan="4">لا توجد بيانات</td></tr>';$('#rTotalFoot').textContent=fmtNum(total);$('#rMaxFoot').textContent=fmtNum(max);$('#rPercentFoot').textContent=percent+'%';const qrBox=$('#qrCode');qrBox.innerHTML='';const link=location.origin+location.pathname+'#result/'+encodeURIComponent(s.seat);new QRCode(qrBox,{text:link,width:110,height:110,colorDark:'#0b3d91',colorLight:'#ffffff'});$('#rDate').textContent=new Date().toLocaleDateString('ar-EG')}
function renderStats(){const s=State.stats;$('#sTotal').textContent=fmtNum(s.total);$('#sSuccess').textContent=fmtNum(s.success);$('#sFailed').textContent=fmtNum(s.failed);const rate=s.total?((s.success/s.total)*100).toFixed(1):0;$('#sRate').textContent=rate+'%';$('#topGovs').innerHTML=(s.topGovs||[]).slice(0,10).map((g,i)=>`<div class="rank-item"><div class="rank-num">${i+1}</div><div class="rank-name">${escapeHTML(g.name)}</div><div class="rank-val">${fmtNum(g.value)}</div></div>`).join('')||'<p>لا توجد بيانات</p>';$('#topSchools').innerHTML=(s.topSchools||[]).slice(0,10).map((g,i)=>`<div class="rank-item"><div class="rank-num">${i+1}</div><div class="rank-name">${escapeHTML(g.name)}</div><div class="rank-val">${fmtNum(g.value)}</div></div>`).join('')||'<p>لا توجد بيانات</p>'}
function renderTop(mode='100'){const list=$('#topList');let items=[];if(mode==='100')items=(State.top.top100||[]);else if(mode==='500')items=(State.top.top500||[]);else if(mode==='gov'){const byGov=State.top.byGov||{};const html=Object.keys(byGov).map(gov=>{const students=byGov[gov]||[];if(!students.length)return'';return`<div style="grid-column:1/-1;margin-top:10px"><h3 style="color:var(--primary)"><i class="fas fa-map"></i> ${escapeHTML(gov)}</h3></div>`+students.slice(0,3).map((s,i)=>topCardHTML(s,i+1)).join(''}).join('');list.innerHTML=html||'<p class="info-box">لا توجد بيانات</p>';return}list.innerHTML=items.map((s,i)=>topCardHTML(s,i+1)).join('')||'<p class="info-box">لا توجد بيانات</p>'}
function topCardHTML(s,rank){return`<div class="top-card glass"><div class="top-rank">${rank}</div><div class="top-info"><h4>${escapeHTML(s.name)}</h4><p><i class="fas fa-id-card"></i> ${s.seat} • <i class="fas fa-map"></i> ${escapeHTML(s.governorate||'')}</p></div><div class="top-score">${fmtNum(s.total)}</div></div>`}
async function printPDF(){const card=$('#resultCard');toast('جاري إنشاء PDF...');try{const canvas=await html2canvas(card,{scale:2,backgroundColor:'#ffffff',useCORS:true});const img=canvas.toDataURL('image/png');const{jsPDF}=window.jspdf;const pdf=new jsPDF('p','mm','a4');const w=pdf.internal.pageSize.getWidth();const h=(canvas.height*w)/canvas.width;pdf.addImage(img,'PNG',0,0,w,h);pdf.save(`نتيجة_${State.currentStudent.seat}.pdf`);toast('تم تحميل PDF','success')}catch(e){toast('فشل إنشاء PDF','error')}}
async function downloadImage(){const card=$('#resultCard');toast('جاري إنشاء الصورة...');try{const canvas=await html2canvas(card,{scale:2,backgroundColor:'#ffffff',useCORS:true});const link=document.createElement('a');link.download=`نتيجة_${State.currentStudent.seat}.png`;link.href=canvas.toDataURL('image/png');link.click();toast('تم تحميل الصورة','success')}catch(e){toast('فشل إنشاء الصورة','error')}}
function shareWhatsApp(){const s=State.currentStudent;if(!s)return;const text=`🎓 نتيجة الثانوية العامة - DAMA\n\nالاسم: ${s.name}\nرقم الجلوس: ${s.seat}\nالمجموع: ${s.total}\n\n${location.origin}${location.pathname}#result/${s.seat}`;window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank')}
function shareFacebook(){const url=location.origin+location.pathname+'#result/'+(State.currentStudent?.seat||'');window.open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url),'_blank')}
function copyLink(){const url=location.origin+location.pathname+'#result/'+(State.currentStudent?.seat||'');navigator.clipboard.writeText(url).then(()=>toast('تم نسخ الرابط','success'))}
function openAdmin(){$('#adminOverlay').classList.remove('hidden');if(!State.adminAuthed){$('#adminLogin').classList.remove('hidden');$('#adminDash').classList.add('hidden')}}
function closeAdmin(){$('#adminOverlay').classList.add('hidden')}
function adminLogin(){const pass=$('#adminPass').value;if(pass===State.settings.password){State.adminAuthed=true;$('#adminLogin').classList.add('hidden');$('#adminDash').classList.remove('hidden');toast('مرحباً بك','success')}else{toast('كلمة المرور غير صحيحة','error')}}
function handleExcel(file){const reader=new FileReader();reader.onload=(e)=>{try{showProgress(10,'جاري قراءة الملف...');const data=new Uint8Array(e.target.result);const wb=XLSX.read(data,{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(ws,{defval:''});if(!rows.length){toast('الملف فارغ','error');hideProgress();return}showProgress(30,`تم قراءة ${rows.length} صف`);processExcel(rows)}catch(err){toast('خطأ في قراءة الملف','error');hideProgress()}};reader.readAsArrayBuffer(file)}
function processExcel(rows){const sample=rows[0];const keys=Object.keys(sample);const map={seat:findKey(keys,['seat','جلوس','رقم الجلوس','رقم','number']),name:findKey(keys,['name','اسم','الاسم','student']),school:findKey(keys,['school','مدرسة','المدرسة']),governorate:findKey(keys,['governorate','محافظة','المحافظة','gov']),administration:findKey(keys,['administration','ادارة','الإدارة','ادارة التعليم']),division:findKey(keys,['division','شعبة','division','قسم']),status:findKey(keys,['status','حالة','الحالة','result']),total:findKey(keys,['total','مجموع','المجموع','degree','الدرجة'])};const subjectKeys=keys.filter(k=>!Object.values(map).includes(k)&&!/^\s*$/.test(String(sample[k])));const subjectsMeta=subjectKeys.map(k=>({key:k,name:k,max:guessMax(sample[k],k)}));showProgress(50,'جاري التحقق...');const students=[];const errors=[];const dupSeats=new Set();const seenSeats=new Set();rows.forEach((r,i)=>{const seat=String(r[map.seat]||'').trim();const name=String(r[map.name]||'').trim();if(!seat||!name){errors.push(`صف ${i+2}: بيانات ناقصة`);return}if(seenSeats.has(seat))dupSeats.add(seat);seenSeats.add(seat);const subjects=subjectsMeta.map(m=>({name:m.name,score:Number(r[m.key])||0,max:m.max}));const total=subjects.reduce((a,b)=>a+(Number(b.score)||0),0);const maxTotal=subjects.reduce((a,b)=>a+(Number(b.max)||0),0);students.push({seat,name,school:String(r[map.school]||'').trim(),governorate:String(r[map.governorate]||'').trim(),administration:String(r[map.administration]||'').trim(),division:String(r[map.division]||'').trim(),status:String(r[map.status]||'').trim()||(maxTotal?(total/maxTotal*100>=CONFIG.passThreshold?'ناجح':'راسب'):'—'),total,maxTotal,subjects})});showProgress(70,'بناء التقارير...');const success=students.filter(s=>s.status==='ناجح'||(s.maxTotal&&s.total/s.maxTotal*100>=CONFIG.passThreshold)).length;const report={total:students.length,success,failed:students.length-success,errors:errors.length,duplicates:dupSeats.size,columns:map};State.adminData={students,report,errors:errors.slice(0,20)};showReport(report,errors);showPreview(students.slice(0,100));showProgress(100,'تمت المعالجة ✓')}
function findKey(keys,candidates){for(const k of keys){const nk=norm(k);for(const c of candidates){if(nk.includes(norm(c)))return k}}return keys[0]}
function guessMax(val,key){const k=norm(key);if(k.includes('عربي')||k.includes('لغه اول')||k.includes('لغة أولى'))return 80;if(k.includes('لغه تانيه')||k.includes('لغة ثانية')||k.includes('لغه ثانيه'))return 40;if(k.includes('دين')||k.includes('تربيه')||k.includes('وطني')||k.includes('قومي'))return 60;if(k.includes('استثمار')||k.includes('فلسفه')||k.includes('نفسي')||k.includes('منطق'))return 60;if(k.includes('جغراف')||k.includes('تاريخ'))return 60;if(k.includes('احياء')||k.includes('جيولوج'))return 60;if(k.includes('فيزياء')||k.includes('كيمياء'))return 60;if(k.includes('رياضه')||k.includes('رياضيات'))return 60;return 100}
function showProgress(pct,text){$('#uploadProgress').classList.remove('hidden');$('.progress-fill').style.width=pct+'%';$('#progressText').textContent=text}
function hideProgress(){$('#uploadProgress').classList.add('hidden')}
function showReport(r,errors){const box=$('#uploadReport');box.classList.remove('hidden');box.innerHTML=`<h4><i class="fas fa-clipboard-check"></i> تقرير المعالجة</h4><ul><li class="ok">إجمالي الطلاب: <strong>${fmtNum(r.total)}</strong></li><li class="ok">الناجحون: <strong>${fmtNum(r.success)}</strong></li><li class="err">الراسبون: <strong>${fmtNum(r.failed)}</strong></li><li class="${r.errors?'warn':'ok'}">أخطاء: <strong>${r.errors}</strong></li><li class="${r.duplicates?'warn':'ok'}">أرقام مكررة: <strong>${r.duplicates}</strong></li></ul>${errors.length?`<h4 style="margin-top:14px">أول ${errors.length} خطأ:</h4><ul>${errors.map(e=>`<li class="warn">${escapeHTML(e)}</li>`).join('')}</ul>`:''}`}
function showPreview(students){const info=$('#previewInfo');info.innerHTML=`<i class="fas fa-info-circle"></i> عرض أول ${students.length} طالب من أصل ${fmtNum(State.adminData.students.length)}`;const tbody=$('#previewTable tbody');tbody.innerHTML=students.map(s=>`<tr><td>${s.seat}</td><td>${escapeHTML(s.name)}</td><td>${escapeHTML(s.school)}</td><td>${escapeHTML(s.governorate)}</td><td>${fmtNum(s.total)}</td></tr>`).join('')}
function buildJSON(){if(!State.adminData){toast('ارفع ملف Excel أولاً','error');return}const log=$('#publishLog');log.textContent='';const write=(m)=>{log.textContent+=m+'\n';log.scrollTop=log.scrollHeight};write('[INFO] بدء بناء JSON...');const students=State.adminData.students;const chunks=[];const index={};for(let i=0;i<students.length;i+=CONFIG.chunkSize){const slice=students.slice(i,i+CONFIG.chunkSize);const idx=String(Math.floor(i/CONFIG.chunkSize)+1).padStart(3,'0');const fname=`chunk-${idx}.json`;chunks.push({name:fname,data:slice});slice.forEach(s=>{index[s.seat]=fname});write(`[OK] ${fname}: ${slice.length} طالب`)}const success=students.filter(s=>s.status==='ناجح'||(s.maxTotal&&s.total/s.maxTotal*100>=CONFIG.passThreshold)).length;const failed=students.length-success;const govMap={};students.forEach(s=>{if(!s.governorate)return;if(!govMap[s.governorate])govMap[s.governorate]={total:0,count:0};govMap[s.governorate].total+=s.total;govMap[s.governorate].count++});const topGovs=Object.entries(govMap).map(([name,v])=>({name,value:Math.round(v.total/v.count)})).sort((a,b)=>b.value-a.value).slice(0,20);const schMap={};students.forEach(s=>{if(!s.school)return;if(!schMap[s.school])schMap[s.school]={total:0,count:0};schMap[s.school].total+=s.total;schMap[s.school].count++});const topSchools=Object.entries(schMap).map(([name,v])=>({name,value:Math.round(v.total/v.count)})).sort((a,b)=>b.value-a.value).slice(0,20);const stats={total:students.length,success,failed,topGovs,topSchools};const sorted=[...students].sort((a,b)=>b.total-a.total);const top100=sorted.slice(0,100);const top500=sorted.slice(0,500);const byGov={};students.forEach(s=>{if(!s.governorate)return;if(!byGov[s.governorate])byGov[s.governorate]=[];byGov[s.governorate].push(s)});Object.keys(byGov).forEach(g=>{byGov[g]=byGov[g].sort((a,b)=>b.total-a.total).slice(0,10)});const top={top100,top500,byGov};State._buildOutput={chunks,index,stats,top};write(`[OK] الإحصائيات: ${students.length} طالب | ${success} ناجح | ${failed} راسب`);write(`[DONE] تم البناء`);toast('تم بناء JSON','success')}
async function publishJSON(){if(!State._buildOutput){toast('قم ببناء JSON أولاً','error');return}const{chunks,index,stats,top}=State._buildOutput;const log=$('#publishLog');const write=(m)=>{log.textContent+=m+'\n';log.scrollTop=log.scrollHeight};write('[INFO] بدء تنزيل الملفات...');for(const c of chunks){downloadJSON('data/'+c.name,c.data);write(`[OK] ${c.name}`);await sleep(100)}downloadJSON(CONFIG.indexFile,index);downloadJSON(CONFIG.statsFile,stats);downloadJSON(CONFIG.topFile,top);downloadJSON(CONFIG.newsFile,State.news);downloadJSON(CONFIG.settingsFile,State.settings);write('[DONE] تم تنزيل جميع الملفات');toast('تم التنزيل','success');State.index=index;State.stats=stats;State.top=top;State.searchCache.clear();renderHome();renderStats()}
function downloadJSON(path,data){const blob=new Blob([JSON.stringify(data)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=path.split('/').pop();document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url)}
function clearData(){if(!confirm('هل أنت متأكد؟'))return;State.index={};State.stats={total:0,success:0,failed:0,topGovs:[],topSchools:[]};State.top={top100:[],top500:[],byGov:{}};State.searchCache.clear();renderHome();renderStats();toast('تم الحذف','success')}
function createBackup(){const backup={version:1,date:new Date().toISOString(),index:State.index,stats:State.stats,top:State.top,news:State.news,settings:State.settings};const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`dama-backup-${Date.now()}.json`;a.click();URL.revokeObjectURL(url);toast('تم تنزيل النسخة','success')}
async function restoreBackup(file){try{const text=await file.text();const data=JSON.parse(text);if(!data.index)throw new Error('ملف غير صالح');State.index=data.index;State.stats=data.stats||State.stats;State.top=data.top||State.top;State.news=data.news||State.news;State.settings=data.settings||State.settings;State.searchCache.clear();renderHome();renderStats();toast('تمت الاستعادة','success')}catch(e){toast('ملف غير صالح','error')}}
function saveSettings(){State.settings.maintenance=$('#setMaintenance').checked;State.settings.announcement=$('#setAnnouncement').value.trim();const newPass=$('#setPass').value.trim();if(newPass)State.settings.password=newPass;downloadJSON(CONFIG.settingsFile,State.settings);applySettings();toast('تم الحفظ','success')}
function applySettings(){$('#maintenanceScreen').classList.toggle('hidden',!State.settings.maintenance);const bar=$('#announcementBar');if(State.settings.announcement){bar.classList.remove('hidden');$('#announcementText').textContent=State.settings.announcement}else{bar.classList.add('hidden')}}
function trackVisitor(){const today=new Date().toDateString();const last=localStorage.getItem('dama_last_visit');if(last!==today){State.counters.visitors++;localStorage.setItem('dama_visitors',State.counters.visitors);localStorage.setItem('dama_last_visit',today)}$('#visitorCount').textContent=fmtNum(State.counters.visitors);$('#searchCount').textContent=fmtNum(State.counters.searches)}
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
function bindEvents(){$('#themeToggle').onclick=toggleTheme;$('#navToggle').onclick=()=>$('.nav-links').classList.toggle('open');$$('[data-route]').forEach(el=>{el.onclick=(e)=>{e.preventDefault();navigate(el.dataset.route);$('.nav-links').classList.remove('open')}});window.addEventListener('hashchange',handleRoute);$$('.search-tabs .tab').forEach(t=>{t.onclick=()=>{$$('.search-tabs .tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');State.searchMode=t.dataset.tab;const input=$('#searchInput');input.value='';input.placeholder=State.searchMode==='seat'?'أدخل رقم الجلوس...':'أدخل اسم الطالب...';$('#suggestions').classList.add('hidden')}});let typingTimer;$('#searchInput').oninput=(e)=>{clearTimeout(typingTimer);const v=e.target.value.trim();if(v.length<2){$('#suggestions').classList.add('hidden');return}typingTimer=setTimeout(()=>{if(State.searchMode==='name')searchByName(v)},300)};$('#searchInput').onkeydown=(e)=>{if(e.key==='Enter'){if(State.searchMode==='seat')searchBySeat(e.target.value);else searchByName(e.target.value)}};$('#clearSearch').onclick=()=>{$('#searchInput').value='';$('#suggestions').classList.add('hidden')};$('#searchBtn').onclick=()=>{const v=$('#searchInput').value.trim();if(State.searchMode==='seat')searchBySeat(v);else searchByName(v)};$('#btnPrint').onclick=printPDF;$('#btnImage').onclick=downloadImage;$('#btnWhatsapp').onclick=shareWhatsApp;$('#btnFacebook').onclick=shareFacebook;$('#btnCopy').onclick=copyLink;$$('.top-tabs .tab').forEach(t=>{t.onclick=()=>{$$('.top-tabs .tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');renderTop(t.dataset.top)}});$('#adminTrigger').onclick=openAdmin;$('#closeAdmin').onclick=closeAdmin;$('#adminLoginBtn').onclick=adminLogin;document.addEventListener('keydown',(e)=>{if(e.ctrlKey&&e.shiftKey&&e.key==='A'){e.preventDefault();openAdmin()}});$$('.admin-tabs .tab').forEach(t=>{t.onclick=()=>{$$('.admin-tabs .tab').forEach(x=>x.classList.remove('active'));$$('.admin-tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');$(`.admin-tab[data-atab="${t.dataset.atab}"]`).classList.add('active')}});const zone=$('#uploadZone');const fileInput=$('#excelFile');$('#pickFile').onclick=()=>fileInput.click();fileInput.onchange=(e)=>{if(e.target.files[0])handleExcel(e.target.files[0])};zone.ondragover=(e)=>{e.preventDefault();zone.classList.add('drag')};zone.ondragleave=()=>zone.classList.remove('drag');zone.ondrop=(e)=>{e.preventDefault();zone.classList.remove('drag');if(e.dataTransfer.files[0])handleExcel(e.dataTransfer.files[0])};$('#btnBuild').onclick=buildJSON;$('#btnPublish').onclick=publishJSON;$('#btnClear').onclick=clearData;$('#btnBackup').onclick=createBackup;$('#pickRestore').onclick=()=>$('#restoreFile').click();$('#restoreFile').onchange=(e)=>{if(e.target.files[0])restoreBackup(e.target.files[0])};$('#btnSaveSettings').onclick=saveSettings;$('#setMaintenance').checked=State.settings.maintenance;$('#setAnnouncement').value=State.settings.announcement||'';$('#closeAnnouncement').onclick=()=>$('#announcementBar').classList.add('hidden')}
function registerSW(){if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(()=>{})}}
async function init(){applyTheme();bindEvents();await loadData();applySettings();renderHome();renderStats();renderTop('100');trackVisitor();handleRoute();registerSW();setTimeout(()=>{$('#loadingScreen').classList.add('done')},800)}
document.addEventListener('DOMContentLoaded',init);

/* ========== GITHUB UPLOAD SYSTEM ========== */
const GitHubUploader = {
  token: null,
  owner: null,
  repo: null,
  branch: 'main',
  
  init() {
    // استرجاع البيانات من localStorage
    this.token = localStorage.getItem('github_token');
    this.owner = localStorage.getItem('github_owner');
    this.repo = localStorage.getItem('github_repo');
  },
  
  setConfig(token, owner, repo) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
    localStorage.setItem('github_token', token);
    localStorage.setItem('github_owner', owner);
    localStorage.setItem('github_repo', repo);
  },
  
  async uploadFile(filePath, content, message = '📊 Upload file') {
    if (!this.token || !this.owner || !this.repo) {
      throw new Error('GitHub config not set');
    }
    
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${filePath}`;
    
    // تشفير المحتوى لـ Base64
    const base64Content = btoa(unescape(encodeURIComponent(content)));
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${this.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        message: message,
        content: base64Content,
        branch: this.branch
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Upload failed');
    }
    
    return await response.json();
  },
  
  async uploadLargeFile(filePath, file, onProgress) {
    if (!this.token || !this.owner || !this.repo) {
      throw new Error('GitHub config not set');
    }
    
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    log(`📦 Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB) in ${totalChunks} chunks`);
    
    // قراءة الملف كـ ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = uint8Array.slice(start, end);
      
      // تحويل الـ chunk لـ Base64
      const base64Chunk = btoa(String.fromCharCode.apply(null, chunk));
      
      const chunkPath = `${filePath}.part${i + 1}`;
      const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${chunkPath}`;
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${this.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          message: `📦 Upload chunk ${i + 1}/${totalChunks}`,
          content: base64Chunk,
          branch: this.branch
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Chunk ${i + 1} failed: ${error.message}`);
      }
      
      const progress = ((i + 1) / totalChunks) * 100;
      onProgress && onProgress(progress, i + 1, totalChunks);
      
      log(`✅ Chunk ${i + 1}/${totalChunks} uploaded`);
    }
    
    // إنشاء ملف manifest
    const manifest = {
      originalName: file.name,
      totalSize: file.size,
      totalChunks: totalChunks,
      chunkSize: CHUNK_SIZE,
      uploadDate: new Date().toISOString()
    };
    
    await this.uploadFile(
      `${filePath}.manifest.json`,
      JSON.stringify(manifest, null, 2),
      `📋 Upload manifest for ${file.name}`
    );
    
    return { success: true, chunks: totalChunks, size: file.size };
  },
  
  async triggerWorkflow(workflowId = 'build.yml') {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/actions/workflows/${workflowId}/dispatches`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ref: this.branch
      })
    });
    
    if (!response.ok && response.status !== 204) {
      throw new Error('Failed to trigger workflow');
    }
    
    return { success: true };
  }
};

// تهيئة النظام
GitHubUploader.init();

// إضافة واجهة رفع في لوحة التحكم
function setupGitHubUpload() {
  const adminDash = $('#adminDash');
  if (!adminDash) return;
  
  // إضافة تبويب جديد
  const tabsContainer = $('.admin-tabs', adminDash);
  const newTab = document.createElement('button');
  newTab.className = 'tab';
  newTab.dataset.atab = 'github';
  newTab.innerHTML = '<i class="fab fa-github"></i> رفع لـ GitHub';
  tabsContainer.appendChild(newTab);
  
  // إضافة محتوى التبويب
  const tabContent = document.createElement('div');
  tabContent.className = 'admin-tab';
  tabContent.dataset.atab = 'github';
  tabContent.innerHTML = `
    <div class="github-config">
      <h3><i class="fab fa-github"></i> إعدادات GitHub</h3>
      <div class="setting">
        <label>Personal Access Token</label>
        <input type="password" id="githubToken" placeholder="ghp_xxxxxxxxxxxx" value="${GitHubUploader.token || ''}" />
      </div>
      <div class="setting">
        <label>Owner (Username)</label>
        <input type="text" id="githubOwner" placeholder="username" value="${GitHubUploader.owner || ''}" />
      </div>
      <div class="setting">
        <label>Repository Name</label>
        <input type="text" id="githubRepo" placeholder="dama-results" value="${GitHubUploader.repo || ''}" />
      </div>
      <button class="btn btn-primary" id="saveGithubConfig">
        <i class="fas fa-save"></i> حفظ الإعدادات
      </button>
    </div>
    
    <div class="github-upload" style="margin-top:20px">
      <h3><i class="fas fa-cloud-upload-alt"></i> رفع ملف Excel</h3>
      <div class="upload-zone" id="githubUploadZone">
        <i class="fas fa-file-excel"></i>
        <p>اسحب ملف Excel هنا أو اضغط للاختيار</p>
        <p class="small">يدعم أي حجم - سيتم التقسيم تلقائياً</p>
        <input type="file" id="githubExcelFile" accept=".xlsx,.xls" hidden />
        <button class="btn btn-primary" id="pickGithubFile">اختر ملف Excel</button>
      </div>
      
      <div id="githubUploadProgress" class="progress hidden">
        <div class="progress-bar">
          <div class="progress-fill" id="githubProgressFill"></div>
        </div>
        <p id="githubProgressText">جاري الرفع...</p>
        <p id="githubProgressDetail" class="small"></p>
      </div>
      
      <div id="githubUploadResult" class="report hidden"></div>
      
      <button class="btn btn-success" id="triggerWorkflow" style="margin-top:14px" disabled>
        <i class="fas fa-rocket"></i> تشغيل GitHub Actions
      </button>
    </div>
    
    <div class="github-help" style="margin-top:20px;padding:14px;background:var(--surface-2);border-radius:12px">
      <h4><i class="fas fa-info-circle"></i> كيفية الحصول على Personal Access Token</h4>
      <ol style="padding-right:20px;list-style:decimal;color:var(--text-soft);font-size:.9rem">
        <li>اذهب إلى <a href="https://github.com/settings/tokens" target="_blank" style="color:var(--primary)">github.com/settings/tokens</a></li>
        <li>اضغط "Generate new token (classic)"</li>
        <li>اختر الصلاحيات: <code>repo</code> و <code>workflow</code></li>
        <li>انسخ الـ token واحفظه هنا</li>
      </ol>
    </div>
  `;
  adminDash.appendChild(tabContent);
  
  // ربط الأحداث
  $('#saveGithubConfig').onclick = () => {
    const token = $('#githubToken').value.trim();
    const owner = $('#githubOwner').value.trim();
    const repo = $('#githubRepo').value.trim();
    
    if (!token || !owner || !repo) {
      toast('املأ كل الحقول', 'error');
      return;
    }
    
    GitHubUploader.setConfig(token, owner, repo);
    toast('تم حفظ الإعدادات', 'success');
  };
  
  const zone = $('#githubUploadZone');
  const fileInput = $('#githubExcelFile');
  
  $('#pickGithubFile').onclick = () => fileInput.click();
  
  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!GitHubUploader.token || !GitHubUploader.owner || !GitHubUploader.repo) {
      toast('احفظ إعدادات GitHub أولاً', 'error');
      return;
    }
    
    await uploadToGitHub(file);
  };
  
  zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('drag'); };
  zone.ondragleave = () => zone.classList.remove('drag');
  zone.ondrop = async (e) => {
    e.preventDefault();
    zone.classList.remove('drag');
    const file = e.dataTransfer.files[0];
    if (file) await uploadToGitHub(file);
  };
  
  $('#triggerWorkflow').onclick = async () => {
    try {
      toast('جاري تشغيل GitHub Actions...', '');
      await GitHubUploader.triggerWorkflow();
      toast('تم تشغيل GitHub Actions بنجاح!', 'success');
      setTimeout(() => {
        window.open(`https://github.com/${GitHubUploader.owner}/${GitHubUploader.repo}/actions`, '_blank');
      }, 1000);
    } catch (err) {
      toast('فشل تشغيل Actions: ' + err.message, 'error');
    }
  };
}

async function uploadToGitHub(file) {
  const progressBox = $('#githubUploadProgress');
  const progressFill = $('#githubProgressFill');
  const progressText = $('#githubProgressText');
  const progressDetail = $('#githubProgressDetail');
  const resultBox = $('#githubUploadResult');
  const triggerBtn = $('#triggerWorkflow');
  
  progressBox.classList.remove('hidden');
  resultBox.classList.add('hidden');
  triggerBtn.disabled = true;
  
  try {
    const startTime = Date.now();
    
    const result = await GitHubUploader.uploadLargeFile(
      'excel/results.xlsx',
      file,
      (progress, current, total) => {
        progressFill.style.width = progress + '%';
        progressText.textContent = `جاري الرفع... ${progress.toFixed(1)}%`;
        progressDetail.textContent = `Chunk ${current}/${total} | ${(file.size / 1024 / 1024).toFixed(2)} MB`;
      }
    );
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    resultBox.classList.remove('hidden');
    resultBox.innerHTML = `
      <h4 class="ok"><i class="fas fa-check-circle"></i> تم الرفع بنجاح!</h4>
      <ul>
        <li class="ok">✅ اسم الملف: <strong>${file.name}</strong></li>
        <li class="ok">✅ الحجم: <strong>${(result.size / 1024 / 1024).toFixed(2)} MB</strong></li>
        <li class="ok">✅ عدد الأجزاء: <strong>${result.chunks}</strong></li>
        <li class="ok">✅ الوقت: <strong>${elapsed} ثانية</strong></li>
      </ul>
      <p style="margin-top:10px;color:var(--text-soft)">
        💡 اضغط "تشغيل GitHub Actions" لبدء معالجة الملف
      </p>
    `;
    
    triggerBtn.disabled = false;
    toast('تم الرفع بنجاح!', 'success');
    
  } catch (err) {
    resultBox.classList.remove('hidden');
    resultBox.innerHTML = `
      <h4 class="err"><i class="fas fa-times-circle"></i> فشل الرفع</h4>
      <p class="err">${err.message}</p>
      <p style="margin-top:10px;color:var(--text-soft)">
        تأكد من صحة الـ Token والصلاحيات
      </p>
    `;
    toast('فشل الرفع: ' + err.message, 'error');
  }
}

// تشغيل الإعداد بعد تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(setupGitHubUpload, 100);
});
