
// ═══════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════
const state = {
    production: [],
    transport: [],
    sales: []
};

// ═══════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════
function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('page-' + name).classList.add('active');
    event.target.classList.add('active');
    if (name === 'admin') refreshAdmin();
    if (name === 'dashboard') refreshDashboard();
}

// ═══════════════════════════════════════════════════
// CLOCK
// ═══════════════════════════════════════════════════
function updateClock() {
    const now = new Date();
    document.getElementById('clock').textContent = now.toLocaleString('en-KE', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

// ═══════════════════════════════════════════════════
// PRODUCTION
// ═══════════════════════════════════════════════════
function logProduction() {
    const baker = document.getElementById('prod-baker').value.trim();
    const bakerId = document.getElementById('prod-baker-id').value.trim();
    const crates = parseInt(document.getElementById('prod-crates').value);
    const time = document.getElementById('prod-time').value;
    const notes = document.getElementById('prod-notes').value.trim();

    if (!baker || !bakerId || !crates || !time) return showToast('Fill all required fields', true);

    const log = { id: Date.now(), baker_name: baker, baker_id: bakerId, crates_completed: crates, completed_at: time, notes };
    state.production.push(log);

    // TODO: POST to /api/production/log
    // fetch('/api/production/log', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(log) })

    refreshProductionLog();
    showToast('Production logged: ' + crates + ' crates by ' + baker);
    document.getElementById('prod-baker').value = '';
    document.getElementById('prod-baker-id').value = '';
    document.getElementById('prod-crates').value = '';
    document.getElementById('prod-notes').value = '';
    document.getElementById('prod-time').value = '';
}

function refreshProductionLog() {
    const tbody = document.getElementById('prod-log-body');
    if (!state.production.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty">No production logs yet</td></tr>'; return; }
    tbody.innerHTML = state.production.slice().reverse().map(l => `
    <tr>
      <td>${l.baker_name}</td>
      <td><span class="badge badge-yellow">${l.baker_id}</span></td>
      <td>${l.crates_completed}</td>
      <td>${new Date(l.completed_at).toLocaleString('en-KE', { hour12: false, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
    </tr>`).join('');

    const total = state.production.reduce((s, l) => s + l.crates_completed, 0);
    const bakers = new Set(state.production.map(l => l.baker_id)).size;
    document.getElementById('stat-total-crates').textContent = total;
    document.getElementById('stat-active-bakers').textContent = bakers;
    document.getElementById('stat-prod-entries').textContent = state.production.length;
}

// ═══════════════════════════════════════════════════
// TRANSPORT
// ═══════════════════════════════════════════════════
function startTrip() {
    const driver = document.getElementById('trp-driver').value.trim();
    const driverId = document.getElementById('trp-driver-id').value.trim();
    const cratesOut = parseInt(document.getElementById('trp-crates-out').value);
    const departure = document.getElementById('trp-departure').value;

    if (!driver || !driverId || !cratesOut || !departure) return showToast('Fill all required fields', true);

    const trip = { id: Date.now(), driver_name: driver, driver_id: driverId, crates_dispatched: cratesOut, crates_returned: 0, departed_at: departure, arrived_at: null, duration_minutes: null, status: 'active' };
    state.transport.push(trip);

    // TODO: POST to /api/transport/trip

    refreshTransportLog();
    showToast('Trip started: ' + driver + ' with ' + cratesOut + ' crates');
    document.getElementById('trp-driver').value = '';
    document.getElementById('trp-driver-id').value = '';
    document.getElementById('trp-crates-out').value = '';
    document.getElementById('trp-departure').value = '';
}

function completeTrip() {
    const tripId = document.getElementById('trp-select').value;
    const arrival = document.getElementById('trp-arrival').value;
    const cratesBack = parseInt(document.getElementById('trp-crates-back').value) || 0;

    if (!tripId || !arrival) return showToast('Select a trip and set arrival time', true);

    const trip = state.transport.find(t => t.id == tripId);
    if (!trip) return;

    trip.arrived_at = arrival;
    trip.crates_returned = cratesBack;
    trip.status = 'completed';
    const mins = Math.round((new Date(arrival) - new Date(trip.departed_at)) / 60000);
    trip.duration_minutes = mins;

    // TODO: POST to /api/transport/trip/:id/arrive

    refreshTransportLog();
    showToast('Trip completed: ' + trip.driver_name + ' — ' + mins + ' mins');
    document.getElementById('trp-arrival').value = '';
    document.getElementById('trp-crates-back').value = '';
}

function refreshTransportLog() {
    const tbody = document.getElementById('trp-log-body');
    const sel = document.getElementById('trp-select');

    const active = state.transport.filter(t => t.status === 'active');
    sel.innerHTML = '<option value="">— Select active trip —</option>' + active.map(t => `<option value="${t.id}">${t.driver_name} (${t.crates_dispatched} crates)</option>`).join('');

    if (!state.transport.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">No trips yet</td></tr>'; return; }
    tbody.innerHTML = state.transport.slice().reverse().map(t => `
    <tr>
      <td>${t.driver_name}</td>
      <td>${t.crates_dispatched}</td>
      <td>${t.crates_returned}</td>
      <td>${t.duration_minutes ? t.duration_minutes + ' min' : '—'}</td>
      <td><span class="badge ${t.status === 'active' ? 'badge-orange' : 'badge-green'}">${t.status}</span></td>
    </tr>`).join('');
}

// ═══════════════════════════════════════════════════
// TIMER
// ═══════════════════════════════════════════════════
let timerInterval = null, timerStart = null, timerElapsed = 0;

function startTimer() {
    if (timerInterval) return;
    timerStart = Date.now() - timerElapsed;
    timerInterval = setInterval(() => {
        timerElapsed = Date.now() - timerStart;
        const h = Math.floor(timerElapsed / 3600000);
        const m = Math.floor((timerElapsed % 3600000) / 60000);
        const s = Math.floor((timerElapsed % 60000) / 1000);
        document.getElementById('timer-display').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        document.getElementById('timer-display').classList.add('timer-running');
    }, 1000);
    document.getElementById('timer-status').textContent = 'Timer running...';
}

function stopTimer() {
    clearInterval(timerInterval); timerInterval = null;
    document.getElementById('timer-display').classList.remove('timer-running');
    const mins = Math.round(timerElapsed / 60000);
    document.getElementById('timer-status').textContent = `Stopped at ${mins} minutes`;
}

function resetTimer() {
    clearInterval(timerInterval); timerInterval = null; timerElapsed = 0;
    document.getElementById('timer-display').textContent = '00:00:00';
    document.getElementById('timer-display').classList.remove('timer-running');
    document.getElementById('timer-status').textContent = 'Timer ready';
}

// ═══════════════════════════════════════════════════
// SALES
// ═══════════════════════════════════════════════════
const PRICES = { retail: 300, wholesale: 250 };

function updateSalePrice() {
    const type = document.getElementById('sale-type').value;
    document.getElementById('sale-price').value = PRICES[type];
    updateSaleTotal();
}

function updateSaleTotal() {
    const crates = parseFloat(document.getElementById('sale-crates').value) || 0;
    const price = parseFloat(document.getElementById('sale-price').value) || 0;
    document.getElementById('sale-total').value = (crates * price).toFixed(0);
    document.getElementById('mpesa-amount').value = crates * price;
}

function recordSale(status, mpesaRef = '') {
    const seller = document.getElementById('sale-seller').value.trim();
    const sellerId = document.getElementById('sale-seller-id').value.trim();
    const type = document.getElementById('sale-type').value;
    const crates = parseInt(document.getElementById('sale-crates').value);
    const price = parseFloat(document.getElementById('sale-price').value);
    const total = parseFloat(document.getElementById('sale-total').value);
    const due = document.getElementById('sale-due').value;

    if (!seller || !sellerId || !crates || !price || !due) return showToast('Fill all required fields', true);

    const sale = { id: Date.now(), seller_name: seller, seller_id: sellerId, sale_type: type, crates_sold: crates, price_per_crate: price, total_amount: total, payment_due: due, payment_status: status, mpesa_ref: mpesaRef };
    state.sales.push(sale);

    // TODO: POST to /api/sales/record

    refreshSalesLog();
    showToast('Sale recorded: KES ' + total.toLocaleString());
}

function refreshSalesLog() {
    const tbody = document.getElementById('sale-log-body');
    if (!state.sales.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">No sales yet</td></tr>'; return; }
    tbody.innerHTML = state.sales.slice().reverse().map(s => `
    <tr>
      <td>${s.seller_name}</td>
      <td><span class="badge ${s.sale_type === 'wholesale' ? 'badge-orange' : 'badge-yellow'}">${s.sale_type}</span></td>
      <td>${s.crates_sold}</td>
      <td>KES ${s.total_amount.toLocaleString()}</td>
      <td><span class="badge ${s.payment_status === 'paid' ? 'badge-green' : 'badge-red'}">${s.payment_status}</span></td>
    </tr>`).join('');

    const revenue = state.sales.filter(s => s.payment_status === 'paid').reduce((sum, s) => sum + s.total_amount, 0);
    const cratesSold = state.sales.reduce((sum, s) => sum + s.crates_sold, 0);
    const pending = state.sales.filter(s => s.payment_status === 'pending').length;
    document.getElementById('stat-revenue').textContent = revenue.toLocaleString();
    document.getElementById('stat-crates-sold').textContent = cratesSold;
    document.getElementById('stat-pending').textContent = pending;
}

function lookupSeller() {
    const query = document.getElementById('lookup-query').value.trim().toLowerCase();
    const result = document.getElementById('lookup-result');
    if (!query) return;

    const matches = state.sales.filter(s => s.seller_name.toLowerCase().includes(query) || s.seller_id.toLowerCase().includes(query));
    if (!matches.length) { result.innerHTML = '<p style="font-family:var(--mono);font-size:0.8rem;color:var(--muted);">No seller found.</p>'; return; }

    const seller = matches[0];
    const total = matches.reduce((s, m) => s + m.total_amount, 0);
    const pending = matches.filter(m => m.payment_status === 'pending').length;
    result.innerHTML = `<div class="card" style="margin-top: 0.75rem;">
    <div style="font-family: var(--mono); font-size: 0.8rem; line-height: 1.8;">
      <div><span style="color: var(--muted);">Seller:</span> <strong>${seller.seller_name}</strong></div>
      <div><span style="color: var(--muted);">ID:</span> ${seller.seller_id}</div>
      <div><span style="color: var(--muted);">Total Sales:</span> KES ${total.toLocaleString()}</div>
      <div><span style="color: var(--muted);">Pending:</span> <span style="color: ${pending ? '#e74c3c' : 'var(--success)'}">${pending} payment(s)</span></div>
    </div>
  </div>`;

    // TODO: GET /api/sales/seller/:id
}

// ═══════════════════════════════════════════════════
// M-PESA MODAL
// ═══════════════════════════════════════════════════
function openMpesaModal() {
    const total = document.getElementById('sale-total').value;
    document.getElementById('mpesa-amount').value = total;
    document.getElementById('mpesa-modal').classList.add('open');
}

function closeMpesaModal() {
    document.getElementById('mpesa-modal').classList.remove('open');
    document.getElementById('mpesa-status').textContent = '';
    document.getElementById('mpesa-phone').value = '';
}

function processMpesa() {
    const phone = document.getElementById('mpesa-phone').value.trim();
    const amount = document.getElementById('mpesa-amount').value;
    const statusEl = document.getElementById('mpesa-status');

    if (!phone.match(/^254\d{9}$/)) return showToast('Enter a valid phone: 254XXXXXXXXX', true);

    statusEl.textContent = 'Sending STK Push...';
    statusEl.style.color = 'var(--accent)';

    // TODO: Call your Flask backend to initiate M-Pesa STK Push:
    // POST /api/sales/mpesa/stk  { phone, amount }
    // Flask calls Safaricom Daraja API, then /api/sales/mpesa/callback receives result

    // Simulated success for frontend demo:
    setTimeout(() => {
        const fakeRef = 'MP' + Math.random().toString(36).substr(2, 8).toUpperCase();
        statusEl.textContent = '✓ Payment confirmed — Ref: ' + fakeRef;
        statusEl.style.color = 'var(--success)';
        setTimeout(() => {
            closeMpesaModal();
            recordSale('paid', fakeRef);
        }, 1500);
    }, 2000);
}

// ═══════════════════════════════════════════════════
// DASHBOARD & ADMIN
// ═══════════════════════════════════════════════════
function refreshDashboard() {
    const totalCrates = state.production.reduce((s, l) => s + l.crates_completed, 0);
    const activeTrips = state.transport.filter(t => t.status === 'active').length;
    const revenue = state.sales.filter(s => s.payment_status === 'paid').reduce((s, l) => s + l.total_amount, 0);
    document.getElementById('dash-crates').textContent = totalCrates;
    document.getElementById('dash-trips').textContent = activeTrips;
    document.getElementById('dash-revenue').textContent = revenue.toLocaleString();

    const prodTbody = document.getElementById('dash-prod-log');
    if (!state.production.length) { prodTbody.innerHTML = '<tr><td colspan="3" class="empty">No logs yet</td></tr>'; }
    else prodTbody.innerHTML = state.production.slice(-5).reverse().map(l => `<tr><td>${l.baker_name}</td><td>${l.crates_completed}</td><td>${new Date(l.completed_at).toLocaleTimeString('en-KE', { hour12: false, hour: '2-digit', minute: '2-digit' })}</td></tr>`).join('');

    const saleTbody = document.getElementById('dash-sales-log');
    if (!state.sales.length) { saleTbody.innerHTML = '<tr><td colspan="4" class="empty">No logs yet</td></tr>'; }
    else saleTbody.innerHTML = state.sales.slice(-5).reverse().map(s => `<tr><td>${s.seller_name}</td><td><span class="badge ${s.sale_type === 'wholesale' ? 'badge-orange' : 'badge-yellow'}">${s.sale_type}</span></td><td>${s.total_amount.toLocaleString()}</td><td><span class="badge ${s.payment_status === 'paid' ? 'badge-green' : 'badge-red'}">${s.payment_status}</span></td></tr>`).join('');
}

function refreshAdmin() {
    document.getElementById('admin-prod-count').textContent = state.production.length;
    document.getElementById('admin-trp-count').textContent = state.transport.length;
    document.getElementById('admin-sale-count').textContent = state.sales.length;

    const pb = document.getElementById('admin-prod-body');
    pb.innerHTML = state.production.length ? state.production.map(l => `<tr><td>${l.baker_name}</td><td>${l.baker_id}</td><td>${l.crates_completed}</td><td>${new Date(l.completed_at).toLocaleString('en-KE', { hour12: false })}</td><td>${l.notes || '—'}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">No production logs</td></tr>';

    const tb = document.getElementById('admin-trp-body');
    tb.innerHTML = state.transport.length ? state.transport.map(t => `<tr><td>${t.driver_name}</td><td>${t.driver_id}</td><td>${t.crates_dispatched}</td><td>${t.crates_returned}</td><td>${new Date(t.departed_at).toLocaleString('en-KE', { hour12: false })}</td><td>${t.arrived_at ? new Date(t.arrived_at).toLocaleString('en-KE', { hour12: false }) : '—'}</td><td>${t.duration_minutes ? t.duration_minutes + ' min' : '—'}</td><td><span class="badge ${t.status === 'active' ? 'badge-orange' : 'badge-green'}">${t.status}</span></td></tr>`).join('') : '<tr><td colspan="8" class="empty">No transport logs</td></tr>';

    const sb = document.getElementById('admin-sale-body');
    sb.innerHTML = state.sales.length ? state.sales.map(s => `<tr><td>${s.seller_name}</td><td>${s.seller_id}</td><td><span class="badge ${s.sale_type === 'wholesale' ? 'badge-orange' : 'badge-yellow'}">${s.sale_type}</span></td><td>${s.crates_sold}</td><td>${s.total_amount.toLocaleString()}</td><td>${s.payment_due}</td><td><span class="badge ${s.payment_status === 'paid' ? 'badge-green' : 'badge-red'}">${s.payment_status}</span></td><td>${s.mpesa_ref || '—'}</td></tr>`).join('') : '<tr><td colspan="8" class="empty">No sales records</td></tr>';
}

function exportData() {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'bakery-data-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
    showToast('Data exported');
}

// ═══════════════════════════════════════════════════
// API DOCS TOGGLE
// ═══════════════════════════════════════════════════
function toggleApi(header) {
    const body = header.nextElementSibling;
    body.classList.toggle('open');
}

// ═══════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════
function showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'show' + (isError ? ' error' : '');
    setTimeout(() => t.className = '', 3000);
}

// ═══════════════════════════════════════════════════
// AUTO-STAMP TIMESTAMPS
// ═══════════════════════════════════════════════════
function nowISO() {
    return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// Wire each auto-stamp field to its "trigger" sibling inputs
const stampTriggers = {
    'prod-time': ['prod-baker', 'prod-baker-id', 'prod-crates', 'prod-notes'],
    'trp-departure': ['trp-driver', 'trp-driver-id', 'trp-crates-out'],
};

Object.entries(stampTriggers).forEach(([stampId, triggerIds]) => {
    triggerIds.forEach(tid => {
        const el = document.getElementById(tid);
        if (!el) return;
        el.addEventListener('input', () => {
            const stamp = document.getElementById(stampId);
            if (!stamp.value) stamp.value = nowISO();
        }, { once: false });
        // Also stamp on first focus
        el.addEventListener('focus', () => {
            const stamp = document.getElementById(stampId);
            if (!stamp.value) stamp.value = nowISO();
        }, { once: false });
    });
});

// Arrival stamps when a trip is selected
function stampArrival() {
    const el = document.getElementById('trp-arrival');
    if (!el.value) el.value = nowISO();
}

(function () {
    const cookieName = 'bakeryos_auth';
    function getCookie(name) {
        return document.cookie.split('; ').reduce((value, cookie) => {
            const [key, val] = cookie.split('=');
            return key === name ? decodeURIComponent(val) : value;
        }, null);
    }

    if (!getCookie(cookieName)) {
        window.location.replace('./login.html');
    }
})();

// Init
updateSalePrice();