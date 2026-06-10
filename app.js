const testData = [
  { title: 'Complete Blood Count (CBC)', desc: 'Hemoglobin, WBC, RBC, Platelets and related indices for overall health monitoring.' },
  { title: 'Lipid Profile', desc: 'Cholesterol and triglyceride levels to assess heart health and metabolic risk.' },
  { title: 'Thyroid Profile', desc: 'Tests like T3, T4 and TSH for thyroid function evaluation.' },
  { title: 'Diabetes Screening', desc: 'HbA1c / Glucose related tests to understand blood sugar status.' },
  { title: 'Kidney Function Test', desc: 'Creatinine, BUN and electrolytes to evaluate kidney health.' },
  { title: 'Liver Function Test', desc: 'ALT, AST, bilirubin and proteins for liver health assessment.' }
];

function renderTests(){
  const el = document.getElementById('testCards');
  if(!el) return;
  el.innerHTML = '';
  for(const t of testData){
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="card-title">${escapeHtml(t.title)}</div><div class="card-desc">${escapeHtml(t.desc)}</div>`;
    el.appendChild(card);
  }
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'<','>':'>','"':'"',"'":'&#39;'}[c]));
}

function toggleMobileMenu(){
  // Simple: not implemented; header nav hides on mobile.
}

async function searchResults({ refId, name }){
  const params = new URLSearchParams();
  if(refId) params.set('refId', refId);
  if(name) params.set('name', name);

  const res = await fetch(`/api/results?${params.toString()}`);
  if(!res.ok) throw new Error('Search failed');
  return res.json();
}

function clearResults(){
  const status = document.getElementById('searchStatus');
  const list = document.getElementById('resultsList');
  if(status){ status.textContent=''; status.className='status'; }
  if(list) list.innerHTML='';
}

function formatDateTime(iso){
  try{ return new Date(iso).toLocaleString(); }catch{ return iso; }
}

function renderResults(results){
  const list = document.getElementById('resultsList');
  if(!list) return;
  list.innerHTML='';

  if(!results || results.length === 0){
    list.innerHTML = `<div class="result-item muted">No results found. Try different Ref ID or Name.</div>`;
    return;
  }

  for(const r of results){
    const item = document.createElement('div');
    item.className = 'result-item';
    const rows = (r.reports || []).map(rep => `
      <tr>
        <td>${escapeHtml(rep.testName || '')}</td>
        <td><b>${escapeHtml(rep.value ?? '')}</b></td>
        <td class="muted">${escapeHtml(rep.unit ?? '')}</td>
        <td class="muted">${escapeHtml(rep.referenceRange ?? '')}</td>
      </tr>
    `).join('');

    const printable = encodeURIComponent(JSON.stringify(r));

    item.innerHTML = `
      <div class="result-head">
        <div>
          <div class="ref">Ref ID: ${escapeHtml(r.refId)}</div>
          <div class="muted">Patient: ${escapeHtml(r.patientName || '')}</div>
          <div class="muted">Created: ${escapeHtml(formatDateTime(r.createdAt))}</div>
        </div>
        <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">
          <a class="btn btn-ghost" href="/print.html?data=${printable}" target="_blank" rel="noopener">Download / Print PDF</a>
        </div>
      </div>
      <table class="table">
        <thead><tr><th>Test</th><th>Value</th><th>Unit</th><th>Reference</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    list.appendChild(item);
  }
}


function wireSearch(){
  const form = document.getElementById('searchForm');
  const status = document.getElementById('searchStatus');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearResults();

    const fd = new FormData(form);
    const refId = fd.get('refId').toString().trim();
    const name = fd.get('name').toString().trim();

    if(!refId && !name){
      status.className = 'status err';
      status.textContent = 'Enter Ref ID or Patient Name to search.';
      return;
    }

    status.className = 'status';
    status.textContent = 'Searching...';

    try{
      const data = await searchResults({ refId, name });
      status.className = 'status ok';
      status.textContent = `Found ${data.results?.length || 0} result(s).`;
      renderResults(data.results);
    }catch(err){
      status.className = 'status err';
      status.textContent = 'Unable to search. Check server and try again.';
    }
  });
}

function wireAppointment(){
  const form = document.getElementById('appointmentForm');
  const status = document.getElementById('appointmentStatus');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.className = 'status';
    status.textContent = 'Submitting...';

    const payload = Object.fromEntries(new FormData(form).entries());

    try{
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Request failed');

      status.className = 'status ok';
      status.textContent = `Appointment requested! ID: ${data.appointmentId}`;
      form.reset();
    }catch(err){
      status.className = 'status err';
      status.textContent = err.message || 'Failed to submit appointment.';
    }
  });
}

function init(){
  document.getElementById('year').textContent = new Date().getFullYear();
  renderTests();
  wireSearch();
  wireAppointment();
}

init();

