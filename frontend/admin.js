const C = window.APP_CONFIG, API = C.API_BASE.replace(/\/$/, '');
let widget = null, data = null, signingIn = false;
let historyNim = null, historyBefore = null, historyRequest = 0;
const $ = selector => document.querySelector(selector);
const tok = () => sessionStorage.getItem('admin_token');
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function msg(text, error = false) {
  $('#message').innerHTML = text ? `<div class="msg ${error ? 'error' : ''}">${esc(text)}</div>` : '';
}
function dateWib(value) {
  if (!value) return '—';
  const raw = String(value);
  const date = new Date(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(raw) ? raw.replace(' ', 'T') + 'Z' : raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta'
  }).format(date) + ' WIB';
}
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (tok()) headers.Authorization = `Bearer ${tok()}`;
  const response = await fetch(API + path, { ...options, headers });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || 'Permintaan gagal');
    error.status = response.status;
    throw error;
  }
  return result;
}
function voteDetails(student) {
  if (!student.voted) return '<span class="muted">Belum ada pilihan</span>';
  const ranks = [1, 2, 3, 4, 5].map(rank =>
    `<li>${esc(student['theme_rank_' + rank] || '—')}</li>`).join('');
  return `<details class="vote-details"><summary>Lihat pilihan</summary>
    <p><strong>Ranking tema (1–5)</strong></p><ol>${ranks}</ol>
    <p><strong>Tema usulan sendiri</strong><br>${esc(student.custom_theme || '—')}</p>
    <p><strong>Alasan / catatan</strong><br>${esc(student.reason || '—')}</p>
    <p class="muted">Pertama tersimpan: ${esc(dateWib(student.created_at))}</p></details>`;
}
function drawStudents(rows) {
  const query = $('#search').value.trim().toLowerCase();
  const matches = rows.filter(student => (student.nim + ' ' + student.name).toLowerCase().includes(query));
  $('#students').innerHTML = matches.length ? matches.map(student => `<tr>
    <td>${esc(student.nim)}${student.nim.startsWith('SMOKE-') ? '<br><span class="badge">Smoke test</span>' : ''}</td>
    <td>${esc(student.name)}</td><td>${student.voted ? 'Sudah voting' : 'Belum voting'}</td>
    <td>${student.voted ? esc(student.group_method || '—') : '—'}</td>
    <td>${student.voted ? esc(student.theme_rank_1 || '—') : '—'}</td>
    <td>${voteDetails(student)}<button type="button" class="btn ghost history-open" data-history-nim="${esc(student.nim)}">Riwayat akses &amp; vote</button></td><td>${esc(dateWib(student.updated_at))}</td>
  </tr>`).join('') : '<tr><td colspan="7">Mahasiswa tidak ditemukan.</td></tr>';
}
function render(result) {
  data = result;
  $('#status').value = result.status;
  $('#deadline').value = result.deadline;
  $('#stats').innerHTML = [
    ['Mahasiswa', result.totalStudents], ['Sudah voting', result.voted],
    ['Belum voting', result.remaining], ['Partisipasi', result.participation + '%']
  ].map(([label, value]) => `<div class="stat"><span class="muted">${esc(label)}</span><b>${esc(value)}</b></div>`).join('');
  drawStudents(result.students);
  $('#lastRefresh').textContent = 'Terakhir diperbarui: ' + dateWib(new Date().toISOString());
}
async function load() {
  const refresh = $('#refresh');
  refresh.disabled = true;
  try {
    render(await api('/api/admin/dashboard'));
    $('#login').classList.add('hidden');
    $('#panel').classList.remove('hidden');
  } finally {
    refresh.disabled = false;
  }
}
$('#form').onsubmit = async event => {
  event.preventDefault();
  if (signingIn) return;
  signingIn = true;
  const button = $('#loginSubmit');
  button.disabled = true;
  button.textContent = 'Sedang masuk…';
  msg('');
  try {
    const result = await api('/api/admin/login', {
      method: 'POST', body: JSON.stringify({
        password: $('#password').value, turnstileToken: turnstile.getResponse(widget)
      })
    });
    sessionStorage.setItem('admin_token', result.token);
    await load();
    $('#password').value = '';
    msg('');
  } catch (error) {
    sessionStorage.removeItem('admin_token');
    msg(error.message, true);
    if (window.turnstile && widget !== null) turnstile.reset(widget);
  } finally {
    signingIn = false;
    button.disabled = false;
    button.textContent = 'Masuk';
  }
};

function eventMarkup(event) {
  const net = event.network || {};
  const location = [net.city, net.region, net.country].filter(Boolean).join(', ') || 'Tidak tersedia';
  const ranks = event.vote ? '<ol>' + [1,2,3,4,5].map(rank =>
    '<li>' + esc(event.vote['theme_rank_' + rank] || '—') + '</li>').join('') + '</ol>' : '';
  const choice = event.vote ? '<details><summary>Pilihan pada penyimpanan ini</summary><p><strong>Metode kelompok:</strong> ' +
    esc(event.vote.group_method) + '</p>' + ranks +
    '<p><strong>Tema usulan:</strong> ' + esc(event.vote.custom_theme || '—') +
    '</p><p><strong>Alasan:</strong> ' + esc(event.vote.reason || '—') + '</p></details>' :
    (event.action === 'save_vote' ? '<p class="muted">Detail pilihan lengkap pada kejadian lama belum direkam.' +
    (event.legacy_method ? ' Metode kelompok: ' + esc(event.legacy_method) : '') + '</p>' : '');
  return '<article class="history-event"><h3>' + (event.action === 'login' ? 'Login mahasiswa' : 'Simpan / ubah vote') +
    '</h3><p><strong>Waktu:</strong> ' + esc(dateWib(event.created_at)) +
    '<br><strong>IP:</strong> ' + esc(net.ip || 'Tidak tersedia / belum direkam') +
    '<br><strong>Perkiraan lokasi:</strong> ' + esc(location) + '</p>' + choice + '</article>';
}
async function loadHistory(append = false) {
  const nim = historyNim, request = ++historyRequest;
  if (!nim) return;
  $('#historyMore').disabled = true;
  $('#historyStatus').textContent = 'Memuat riwayat…';
  try {
    const query = append && historyBefore ? '?before=' + historyBefore : '';
    const result = await api('/api/admin/students/' + encodeURIComponent(nim) + '/history' + query);
    if (request !== historyRequest || nim !== historyNim) return;
    $('#historyTitle').textContent = 'Riwayat — ' + result.student.name + ' (' + result.student.nim + ')';
    const content = result.events.map(eventMarkup).join('');
    if (append) $('#historyList').innerHTML += content;
    else $('#historyList').innerHTML = content || '<p class="muted">Belum ada aktivitas login atau penyimpanan vote yang tercatat.</p>';
    historyBefore = result.nextBefore;
    $('#historyMore').classList.toggle('hidden', !historyBefore);
    $('#historyStatus').textContent = 'Urutan terbaru dahulu. Waktu ditampilkan dalam WIB.';
  } catch (error) {
    if (request === historyRequest) $('#historyStatus').textContent = error.message;
  } finally {
    if (request === historyRequest) $('#historyMore').disabled = false;
  }
}
$('#students').onclick = async event => {
  const button = event.target.closest('button[data-history-nim]');
  if (!button) return;
  historyNim = button.dataset.historyNim;
  historyBefore = null;
  $('#historyList').innerHTML = '';
  $('#historyMore').classList.add('hidden');
  $('#historyPanel').classList.remove('hidden');
  $('#historyTitle').textContent = 'Riwayat — ' + historyNim;
  $('#historyPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  await loadHistory();
};
$('#historyMore').onclick = () => loadHistory(true);
$('#historyClose').onclick = () => {
  historyNim = null; historyBefore = null; historyRequest++;
  $('#historyPanel').classList.add('hidden');
  $('#historyList').innerHTML = '';
};

$('#refresh').onclick = async () => {
  msg('');
  try { await load(); } catch (error) { msg(error.message, true); }
};
$('#save').onclick = async () => {
  try {
    await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify({
      status: $('#status').value, deadline: $('#deadline').value
    }) });
    await load();
    msg('Pengaturan tersimpan.');
  } catch (error) { msg(error.message, true); }
};
$('#export').onclick = async () => {
  try {
    const response = await fetch(API + '/api/admin/export', { headers: { Authorization: `Bearer ${tok()}` } });
    if (!response.ok) throw new Error('Export gagal.');
    const blob = await response.blob(), link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = 'aifn1-votes.csv';
    link.click(); URL.revokeObjectURL(link.href);
  } catch (error) { msg(error.message, true); }
};
$('#reset').onclick = async () => {
  if (!confirm('Hapus seluruh vote? Tindakan ini tidak dapat dibatalkan.')) return;
  try { await api('/api/admin/reset', { method: 'DELETE' }); await load(); msg('Seluruh vote direset.'); }
  catch (error) { msg(error.message, true); }
};
$('#resetSmoke').onclick = async () => {
  if (!confirm('Reset sesi dan vote SMOKE-AIFN1-2026?')) return;
  try {
    const result = await api('/api/admin/reset-smoke-test', { method: 'DELETE' });
    await load(); msg(result.message);
  } catch (error) { msg(error.message, true); }
};
$('#simulate').onclick = async () => {
  try {
    const result = await api('/api/admin/groups');
    $('#groups').innerHTML = result.groups.map((group, i) => `<div class="group-card"><b>Kelompok ${i + 1}</b><ol>${group.map(student => `<li>${esc(student.name)} <span class="muted">${esc(student.theme)}</span></li>`).join('')}</ol></div>`).join('');
  } catch (error) { msg(error.message, true); }
};
$('#search').oninput = () => data && drawStudents(data.students);
$('#logout').onclick = async () => {
  try { await api('/api/logout', { method: 'POST' }); } catch {}
  sessionStorage.removeItem('admin_token'); location.reload();
};
(async () => {
  try {
    const config = await api('/api/config');
    const wait = setInterval(() => {
      if (window.turnstile) {
        clearInterval(wait);
        widget = turnstile.render('#turnstile', {
          sitekey: config.turnstileSiteKey, theme: 'auto', action: 'admin-login'
        });
      }
    }, 200);
    if (tok()) {
      try { await load(); msg(''); } catch { sessionStorage.removeItem('admin_token'); }
    }
  } catch (error) { msg(error.message, true); }
})();
