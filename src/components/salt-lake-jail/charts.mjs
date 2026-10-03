// Pure aggregate calculations are shared by prerendering, the browser and tests.
export const DATA_URL = '/articles/salt-lake-jail/data.json';
export const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export const format = (value, digits=2) => value == null ? '—' : Number(value).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
export const dateLabel = date => new Date((date.length===7?date+'-15':date.slice(0,10))+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:date.length>7?'numeric':undefined,year:'numeric',timeZone:'UTC'});

export function demographicSeries(data, {field='citizen', focus='label:VENEZUELA', excluded=[], start='', end='', quality='screened', measure='share'}={}) {
  const group=data.fields[field];
  if(!group)throw new Error('Unknown demographic field');
  const excludedKeys=new Set(excluded),visible=group.categories.map((c,i)=>({...c,index:i})).filter(c=>!excludedKeys.has(c.key));
  const focusIndex=visible.find(c=>c.key===focus)?.index;
  return data.runs.flatMap((run,i)=>{
    if((start&&run.date<start)||(end&&run.date>end)||(quality==='screened'&&run.alert))return [];
    const counts=group.counts[i],remaining=visible.reduce((sum,c)=>sum+counts[c.index],0);
    const matching=focusIndex==null?null:counts[focusIndex];
    return [{date:run.date,full:run.total,remaining,excluded:run.total-remaining,matching,alert:run.alert,index:i,
      value:matching==null?null:measure==='count'?matching:remaining?matching/remaining*100:null}];
  });
}

export function lineChart(rows, {ceiling=100, percent=true, label='', color='var(--jail-teal)', width=650, highlightQ4=false}={}) {
  width=Math.max(280,width);const height=275,left=48,right=18,top=26,bottom=42;
  const t=date=>Date.parse(date.slice(0,10)+'T12:00:00Z');
  const valid=rows.filter(r=>Number.isFinite(r.value));
  if(!valid.length)return '<p class="jail-empty">No values for this selection. Restore a label or widen the date range.</p>';
  const first=t(rows[0].date),last=t(rows.at(-1).date),range=last-first;
  const x=date=>range?left+(t(date)-first)/range*(width-left-right):(width+left-right)/2;
  const y=value=>height-bottom-value/ceiling*(height-top-bottom);
  let svg=`<svg data-line-chart viewBox="0 0 ${width} ${height}" role="img" tabindex="0" aria-label="${escape(label)}. Use left and right arrows, Home or End to inspect points. Values are also available in the table.">`;
  if(highlightQ4)for(const year of [2023,2025]) {
    const a=x(year+'-10-01'),b=x(year+'-12-31');
    svg+=`<rect x="${a}" y="${top}" width="${b-a}" height="${height-top-bottom}" fill="var(--jail-band)"/><text x="${(a+b)/2}" y="15" text-anchor="middle" fill="var(--jail-muted)" font-size="10">Q4 ${year}</text>`;
  }
  for(let i=0;i<=4;i++){
    const value=ceiling*i/4,yy=y(value);
    svg+=`<line x1="${left}" x2="${width-right}" y1="${yy}" y2="${yy}" stroke="var(--jail-rule)"/><text x="${left-8}" y="${yy+4}" text-anchor="end" font-size="12" fill="var(--jail-muted)">${Number(value.toFixed(2))}${percent?'%':''}</text>`;
  }
  const ticks=Math.min(width<480?3:4,rows.length);
  for(let i=0;i<ticks;i++){
    const row=rows[Math.round(i*(rows.length-1)/Math.max(1,ticks-1))];
    const text=new Date(t(row.date)).toLocaleDateString('en-US',{month:'short',year:'2-digit',timeZone:'UTC'});
    svg+=`<text x="${x(row.date)}" y="${height-12}" text-anchor="${i===0?'start':i===ticks-1?'end':'middle'}" font-size="12" fill="var(--jail-muted)">${text}</text>`;
  }
  const segments=[];let segment=[];
  for(const row of rows){
    if(!Number.isFinite(row.value)){if(segment.length)segments.push(segment);segment=[];continue;}
    if(segment.length&&t(row.date)-t(segment.at(-1).date)>35*86400000){segments.push(segment);segment=[];}
    segment.push(row);
  }
  if(segment.length)segments.push(segment);
  for(const part of segments)svg+=`<polyline points="${part.map(row=>`${x(row.date)},${y(row.value)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>`;
  rows.forEach((row,index)=>{
    if(!Number.isFinite(row.value))return;
    svg+=`<g data-point="${index}"><circle cx="${x(row.date)}" cy="${y(row.value)}" r="9" fill="transparent"/><circle class="jail-point" cx="${x(row.date)}" cy="${y(row.value)}" r="3" fill="${row.alert?'var(--jail-amber)':color}" stroke="var(--jail-surface)" stroke-width="1"><title>${escape(row.label??row.date)}: ${format(row.value,percent?2:0)}${percent?'%':''}</title></circle></g>`;
  });
  return svg+'</svg>';
}

export function chargeBars(charges, mode='all') {
  const labels=[['Old description: interference with arresting officer','old_pct'],['New description: interfering with a peace officer','new_pct'],['All descriptions for recorded code 76-8-305','pct']];
  return labels.filter(([,key])=>mode==='all'||mode===key).map(([label,key])=>`<div class="jail-charge-row"><h4>${label}</h4>${charges.map((row,i)=>`<div class="jail-bar-row"><span>Q4 ${row.yr}</span><div class="jail-bar-track"><div class="jail-bar ${i?'late':''}" style="width:${row[key]*10}%"></div></div><strong>${format(row[key])}%</strong></div>`).join('')}</div>`).join('');
}

export function mountCharts() {
  let request;
  const getData=()=>request??=fetch(DATA_URL).then(r=>{if(!r.ok)throw Error('The aggregate dataset could not be loaded.');return r.json();});
  document.querySelectorAll('[data-jail-chart]').forEach(async root=>{
    if(root.dataset.ready)return;root.dataset.ready='true';
    const q=selector=>root.querySelector(selector);
    try{
      const data=await getData();
      if(root.dataset.jailChart==='charges'){
        q('[data-charge-mode]').addEventListener('change',event=>{q('[data-bars]').innerHTML=chargeBars(data.article.charges,event.target.value);});return;
      }
      let series=[],selected=0,resizeTimer;
      const inspect=index=>{
        selected=index;
        if(root.dataset.jailChart==='trends'){
          const r=data.article.months[index];if(!r||r.venezuela_pct==null)return;
          q('[data-readout]').textContent=`${dateLabel(r.month)} · Venezuela ${format(r.venezuela_pct)}% · United States ${format(r.us_pct)}% · ${r.runs} rosters`;
        }else{
          const r=series[index];if(!r)return;
          q('[data-roster]').value=r.date;renderRoster(r);
        }
        root.querySelectorAll('[data-point]').forEach(point=>point.classList.toggle('selected',Number(point.dataset.point)===index));
      };
      root.addEventListener('pointerover',event=>{const point=event.target.closest('[data-point]');if(point)inspect(Number(point.dataset.point));});
      root.addEventListener('click',event=>{const point=event.target.closest('[data-point]');if(point)inspect(Number(point.dataset.point));});
      root.addEventListener('keydown',event=>{
        if(!event.target.matches('svg[data-line-chart]')||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        event.preventDefault();
        const valid=series.map((r,i)=>Number.isFinite(r.value)?i:null).filter(i=>i!==null);
        if(!valid.length)return;
        const current=Math.max(0,valid.indexOf(selected));
        inspect(event.key==='Home'?valid[0]:event.key==='End'?valid.at(-1):valid[Math.max(0,Math.min(valid.length-1,current+(event.key==='ArrowRight'?1:-1)))]);
      });
      if(root.dataset.jailChart==='trends'){
        const render=()=>{
          series=data.article.months.map(r=>({date:r.month+'-15',value:r.venezuela_pct}));
          for(const [key,ceiling,color] of [['venezuela_pct',3,'var(--jail-teal)'],['us_pct',100,'var(--jail-blue)']]){
            const host=q(`[data-series="${key}"]`);
            host.innerHTML=lineChart(data.article.months.map(r=>({date:r.month+'-15',label:dateLabel(r.month),value:r[key]})),{ceiling,color,width:host.clientWidth,label:key==='us_pct'?'United States citizenship share':'Venezuela citizenship share',highlightQ4:true});
          }
        };
        render();new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(render,120);}).observe(root);return;
      }
      const excluded={citizen:new Set(),cob:new Set()};
      const state={field:'citizen',focus:'label:VENEZUELA',measure:'share',quality:'screened',start:data.runs[0].date,end:data.runs.at(-1).date};
      function renderRoster(row){
        const field=data.fields[state.field],set=excluded[state.field];
        const current=field.categories.find(c=>c.key===state.focus);
        q('[data-readout]').textContent=`${dateLabel(row.date)} · ${current?.label??'No label selected'}: ${format(row.matching,0)} bookings · ${row.remaining?format((row.matching??0)/row.remaining*100)+'% of remaining bookings':'no remaining bookings'}`;
        q('[data-denominator]').textContent=`Full roster: ${format(row.full,0)} · Excluded: ${format(row.excluded,0)} · Remaining denominator: ${format(row.remaining,0)}. ${set.size?'Shares use the remaining bookings after exclusions.':'Shares use all bookings, including missing and ambiguous labels.'}${row.alert?' This roster has a coverage alert.':''}`;
        const records=field.categories.map((c,i)=>({...c,count:field.counts[row.index][i]})).filter(c=>!set.has(c.key)&&(c.count>0||c.key===state.focus)).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label));
        q('[data-categories]').innerHTML=records.length?records.map(c=>`<tr><td><button type="button" data-focus="${escape(c.key)}" aria-pressed="${c.key===state.focus}">${escape(c.label)}</button>${c.kind!=='recorded'?`<small>${escape(c.kind==='ambiguous'?'Ambiguous citizenship label':c.kind)}</small>`:''}</td><td>${format(c.count,0)}</td><td>${row.remaining?format(c.count/row.remaining*100)+'%':'—'}</td></tr>`).join(''):'<tr><td colspan="3">No remaining labels on this roster.</td></tr>';
      }
      function render(){
        const field=data.fields[state.field],set=excluded[state.field],available=field.categories.filter(c=>!set.has(c.key));
        if(!available.some(c=>c.key===state.focus))state.focus=available[0]?.key??'';
        q('[data-focus-select]').innerHTML=available.length?available.map(c=>`<option value="${escape(c.key)}" ${c.key===state.focus?'selected':''}>${escape(c.label)}</option>`).join(''):'<option value="">All labels excluded</option>';
        q('[data-focus-select]').disabled=!available.length;
        q('[data-exclusion-list]').innerHTML=field.categories.map(c=>`<label data-label="${escape(c.label.toLowerCase())}"><input type="checkbox" value="${escape(c.key)}" ${set.has(c.key)?'checked':''}/><span>${escape(c.label)}</span></label>`).join('');
        q('[data-label-search]').value='';
        q('[data-exclusion-count]').textContent=`Exclude labels (${set.size} excluded)`;
        const us=q('[data-exclude-us]');us.disabled=!field.categories.some(c=>c.key==='label:UNITED STATES')||set.has('label:UNITED STATES');
        series=demographicSeries(data,{...state,excluded:[...set]});
        const valid=series.filter(r=>Number.isFinite(r.value)),max=Math.max(0,...valid.map(r=>r.value));
        const ceiling=state.measure==='share'?Math.min(100,Math.max(1,Math.ceil(max/5)*5)):Math.max(4,Math.ceil(max/4)*4);
        const label=field.categories.find(c=>c.key===state.focus)?.label??'No label';
        q('[data-series-chart]').innerHTML=lineChart(series,{ceiling,percent:state.measure==='share',label:`${field.title}: ${label}`,width:q('[data-series-chart]').clientWidth});
        q('[data-chart-unit]').textContent=`${field.title} · ${label} · ${state.measure==='share'?'share of remaining bookings':'observed bookings'} · ${series.length} rosters`;
        const previous=q('[data-roster]').value;
        q('[data-roster]').innerHTML=series.map(r=>`<option value="${r.date}">${dateLabel(r.date)}${r.alert?' · coverage alert':''}</option>`).join('');
        selected=Math.max(0,series.findIndex(r=>r.date===previous));
        if(!previous||!series.some(r=>r.date===previous))selected=series.length-1;
        if(series.length)inspect(selected);else{q('[data-readout]').textContent='No rosters in this date range.';q('[data-denominator]').textContent='Choose a date range between June 3, 2023 and February 24, 2026.';q('[data-categories]').innerHTML='';}
      }
      for(const key of ['field','measure','quality','start','end'])q(`[data-control="${key}"]`).addEventListener('change',event=>{state[key]=event.target.value;render();});
      q('[data-focus-select]').addEventListener('change',event=>{state.focus=event.target.value;render();});
      q('[data-roster]').addEventListener('change',event=>{const index=series.findIndex(r=>r.date===event.target.value);if(index>=0)inspect(index);});
      q('[data-exclusion-list]').addEventListener('change',event=>{if(!event.target.matches('input[type="checkbox"]'))return;event.target.checked?excluded[state.field].add(event.target.value):excluded[state.field].delete(event.target.value);render();});
      q('[data-label-search]').addEventListener('input',event=>{const term=event.target.value.trim().toLowerCase();q('[data-exclusion-list]').querySelectorAll('[data-label]').forEach(label=>{label.hidden=!label.dataset.label.includes(term);});});
      q('[data-exclude-us]').addEventListener('click',()=>{excluded[state.field].add('label:UNITED STATES');render();});
      q('[data-restore]').addEventListener('click',()=>{excluded[state.field].clear();render();});
      q('[data-categories]').addEventListener('click',event=>{const button=event.target.closest('[data-focus]');if(button){state.focus=button.dataset.focus;render();}});
      render();new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(render,150);}).observe(q('[data-series-chart]'));
    }catch(error){const status=q('[data-readout]')||q('[data-error]');if(status)status.textContent=error.message;}
  });
}
