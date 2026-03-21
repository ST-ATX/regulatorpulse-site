/* ============================================================
   RegulatorPulse - Core Application JS
   v1.0 (2026-03-20)
   ============================================================ */

(function () {
  'use strict';

  /* ── Constants ── */
  const CORRECT = 'regulatorpulse';
  const GATE_KEY = 'rp_auth';
  const PROFILE_KEY = 'rp_profile';

  const STATES = [
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
    'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
    'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
    'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
    'New Hampshire','New Jersey','New Mexico','New York','North Carolina',
    'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
    'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
    'Virginia','Washington','West Virginia','Wisconsin','Wyoming'
  ];

  /* ── Vertical map (select value -> JSON vertical field) ── */
  const VERTICAL_KEY = {
    'Medical Spa':          'medspa',
    'Salon & Barbershop':   'salon',
    'Gym & Fitness Studio': 'gym'
  };

  const VERTICAL_LABEL = {
    'medspa': 'Medical Spa',
    'salon':  'Salon & Barbershop',
    'gym':    'Gym & Fitness Studio'
  };

  /* ── Mock stats ── */
  const STATS = { score: 87, pending: 3, updated: 'Today' };

  /* ============================================================
     PASSWORD GATE
     ============================================================ */

  function checkGate() {
    try { return localStorage.getItem(GATE_KEY) === '1'; } catch(e) { return false; }
  }

  function initGate() {
    const gateEl = document.getElementById('rp-gate');
    const appEl  = document.getElementById('rp-app');
    if (!gateEl) return;

    if (checkGate()) {
      gateEl.classList.add('hidden');
      if (appEl) appEl.classList.remove('hidden');
      initApp();
      return;
    }

    if (appEl) appEl.classList.add('hidden');

    const input = document.getElementById('rp-gate-input');
    const btn   = document.getElementById('rp-gate-btn');
    const err   = document.getElementById('rp-gate-error');

    function attempt() {
      if (!input) return;
      const val = input.value.trim().toLowerCase();
      if (val === CORRECT) {
        try { localStorage.setItem(GATE_KEY, '1'); } catch(e) {}
        gateEl.classList.add('hidden');
        if (appEl) appEl.classList.remove('hidden');
        initApp();
      } else {
        if (err) err.textContent = 'Incorrect passphrase. Please try again.';
        input.value = '';
        input.focus();
      }
    }

    if (btn) btn.addEventListener('click', attempt);
    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') attempt();
        if (err && e.key !== 'Enter') err.textContent = '';
      });
      setTimeout(function() { input.focus(); }, 100);
    }
  }

  /* ============================================================
     PROFILE
     ============================================================ */

  function getProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  }

  function saveProfile(profile) {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch(e) {}
  }

  /* ============================================================
     ONBOARDING MODAL
     ============================================================ */

  function buildOnboarding() {
    const overlay = document.getElementById('rp-onboarding-overlay');
    if (!overlay) return;

    const stateSelect = document.getElementById('rp-onboard-state');
    if (stateSelect) {
      STATES.forEach(function(s) {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        if (s === 'Texas') opt.selected = true;
        stateSelect.appendChild(opt);
      });
    }

    const startBtn = document.getElementById('rp-onboard-submit');
    if (startBtn) {
      startBtn.addEventListener('click', function() {
        const nameInput = document.getElementById('rp-onboard-name');
        const vertInput = document.getElementById('rp-onboard-vertical');
        const stInput   = document.getElementById('rp-onboard-state');

        const name  = nameInput ? nameInput.value.trim() : '';
        const vert  = vertInput ? vertInput.value : 'Medical Spa';
        const state = stInput   ? stInput.value   : 'Texas';

        if (!name) {
          if (nameInput) {
            nameInput.style.borderColor = 'var(--red)';
            nameInput.focus();
          }
          return;
        }

        const profile = {
          businessName: name,
          vertical: vert,
          state: state,
          createdAt: new Date().toISOString()
        };

        saveProfile(profile);
        overlay.classList.add('hidden');
        initDashboardContent(profile);
      });
    }
  }

  function showOnboarding() {
    const overlay = document.getElementById('rp-onboarding-overlay');
    if (overlay) overlay.classList.remove('hidden');
  }

  /* ============================================================
     GREETING
     ============================================================ */

  function getGreeting(name) {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    return name ? part + ', ' + name : part;
  }

  /* ============================================================
     ALERT RENDERING
     ============================================================ */

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtDate(d) {
    if (!d) return '';
    try {
      return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
    } catch(e) { return d; }
  }

  function severityClass(sev) {
    return sev === 'high' ? 'rp-badge-high' : sev === 'medium' ? 'rp-badge-medium' : 'rp-badge-low';
  }

  function severityLabel(sev) {
    return sev === 'high' ? 'High' : sev === 'medium' ? 'Medium' : 'Low';
  }

  function trunc(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n).trimEnd() + '...' : s;
  }

  function renderAlerts(alerts, container) {
    if (!container) return;
    if (!alerts || alerts.length === 0) {
      container.innerHTML = '<div class="rp-alert-empty">No alerts found for your vertical.</div>';
      return;
    }
    container.innerHTML = alerts.map(function(a) {
      return '<div class="rp-alert-card">' +
        '<div class="rp-alert-card-top">' +
          '<div class="rp-alert-title">' + esc(a.title) + '</div>' +
          '<div class="rp-alert-badges">' +
            '<span class="rp-badge ' + severityClass(a.severity) + '">' + severityLabel(a.severity) + '</span>' +
          '</div>' +
        '</div>' +
        (a.category ? '<div style="margin-bottom:.4rem"><span class="rp-badge-cat">' + esc(a.category.replace(/-/g,' ')) + '</span></div>' : '') +
        '<div class="rp-alert-summary">' + esc(trunc(a.summary, 150)) + '</div>' +
        '<div class="rp-alert-footer">' +
          '<span class="rp-alert-source">' + esc(a.source || '') + '</span>' +
          '<span class="rp-alert-date">' + fmtDate(a.date) + '</span>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function loadAlerts(profile) {
    const container = document.getElementById('rp-alert-list');
    if (!container) return;

    const vertKey = profile ? VERTICAL_KEY[profile.vertical] : null;

    fetch('alerts-data.json')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        let alerts = data.alerts || [];

        if (vertKey) {
          alerts = alerts.filter(function(a) {
            return !a.vertical || a.vertical === vertKey;
          });
        }

        alerts.sort(function(a, b) {
          return (b.date || '').localeCompare(a.date || '');
        });

        alerts = alerts.slice(0, 6);
        renderAlerts(alerts, container);

        const statEl = document.getElementById('rp-stat-alerts');
        if (statEl) statEl.textContent = alerts.length;
      })
      .catch(function() {
        if (container) container.innerHTML = '<div class="rp-alert-empty">Unable to load alerts.</div>';
      });
  }

  /* ============================================================
     HEADLINE RENDERING
     ============================================================ */

  function renderHeadlineList(headlines, container) {
    if (!container) return;
    const ul = document.createElement('ul');
    ul.className = 'rp-headline-list';
    headlines.forEach(function(h) {
      const li = document.createElement('li');
      li.innerHTML =
        '<div class="rp-headline-row">' +
          '<span class="rp-source-pill">' + esc(h.source || '') + '</span>' +
          '<a class="rp-headline-link" href="' + esc(h.url || '#') + '" target="_blank" rel="noopener">' + esc(h.title) + '</a>' +
        '</div>' +
        '<div class="rp-headline-date">' + fmtDate(h.date) + '</div>';
      ul.appendChild(li);
    });
    container.innerHTML = '';
    container.appendChild(ul);
  }

  function loadHeadlines() {
    const intelEl    = document.getElementById('rp-intel-list');
    const marketEl   = document.getElementById('rp-headline-list');

    fetch('headlines-data.json')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        const all    = data.headlines || [];
        const intel  = all.slice(0, 4);
        const market = all.slice(4, 8);
        if (intelEl)  renderHeadlineList(intel,  intelEl);
        if (marketEl) renderHeadlineList(market, marketEl);
      })
      .catch(function() {
        const msg = '<p style="padding:.75rem 1.1rem;color:var(--text-muted);font-size:.83rem;">Unable to load headlines.</p>';
        if (intelEl)  intelEl.innerHTML  = msg;
        if (marketEl) marketEl.innerHTML = msg;
      });
  }

  /* ============================================================
     COMPLIANCE TIP
     ============================================================ */

  function loadTip(profile) {
    const tipLabel = document.getElementById('rp-tip-label');
    const tipTitle = document.getElementById('rp-tip-title');
    const tipBody  = document.getElementById('rp-tip-body');
    const tipSrc   = document.getElementById('rp-tip-source');
    if (!tipTitle || !tipBody) return;

    const vertKey = profile ? VERTICAL_KEY[profile.vertical] : null;

    fetch('compliance-tips.json')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        let tips = data.tips || [];
        if (vertKey) {
          tips = tips.filter(function(t) { return !t.vertical || t.vertical === vertKey; });
        }
        if (!tips.length) return;

        // Daily rotation by day-of-year
        const now   = new Date();
        const start = new Date(now.getFullYear(), 0, 0);
        const day   = Math.floor((now - start) / 86400000);
        const tip   = tips[day % tips.length];

        if (tipLabel) tipLabel.textContent = 'Daily Tip: ' + (tip.category || 'Compliance');
        tipTitle.textContent = tip.title || '';
        tipBody.textContent  = tip.body  || '';
        if (tipSrc && tip.source) tipSrc.textContent = tip.source;
      })
      .catch(function() {});
  }

  /* ============================================================
     STATS
     ============================================================ */

  function populateStats() {
    var scoreEl   = document.getElementById('rp-stat-score');
    var pendingEl = document.getElementById('rp-stat-pending');
    var updatedEl = document.getElementById('rp-stat-updated');
    if (scoreEl)   scoreEl.textContent   = STATS.score + '%';
    if (pendingEl) pendingEl.textContent = STATS.pending;
    if (updatedEl) updatedEl.textContent = STATS.updated;
  }

  /* ============================================================
     SIDEBAR
     ============================================================ */

  function initSidebar() {
    const mobileBtn = document.getElementById('rp-mobile-menu-btn');
    const sidebar   = document.getElementById('rp-sidebar');
    const overlay   = document.getElementById('rp-sidebar-overlay');
    const closeBtn  = document.getElementById('rp-sidebar-close');

    function openSidebar()  { if (sidebar) sidebar.classList.add('open'); if (overlay) overlay.classList.remove('hidden'); }
    function closeSidebar() { if (sidebar) sidebar.classList.remove('open'); if (overlay) overlay.classList.add('hidden'); }

    if (mobileBtn) mobileBtn.addEventListener('click', openSidebar);
    if (overlay)   overlay.addEventListener('click', closeSidebar);
    if (closeBtn)  closeBtn.addEventListener('click', closeSidebar);
  }

  /* ============================================================
     INIT DASHBOARD CONTENT
     ============================================================ */

  function initDashboardContent(profile) {
    var greetEl   = document.getElementById('rp-greeting');
    var subEl     = document.getElementById('rp-greeting-sub');
    var bizSide   = document.getElementById('rp-sidebar-business');
    var bizTopbar = document.getElementById('rp-topbar-business');

    if (greetEl) greetEl.textContent = getGreeting(profile ? profile.businessName : null);

    if (subEl && profile) {
      var vertLabel = VERTICAL_LABEL[VERTICAL_KEY[profile.vertical]] || profile.vertical || '';
      subEl.textContent = vertLabel + ' in ' + (profile.state || '') + '. Your compliance dashboard. Stay ahead of regulations that affect your business.';
    } else if (subEl) {
      subEl.textContent = 'Your compliance dashboard. Stay ahead of regulations that affect your business.';
    }

    if (bizSide   && profile) bizSide.textContent   = profile.businessName;
    if (bizTopbar && profile) bizTopbar.textContent = profile.businessName;

    populateStats();
    loadAlerts(profile);
    loadHeadlines();
    loadTip(profile);

    if (window.lucide) lucide.createIcons();
  }

  /* ============================================================
     INIT APP
     ============================================================ */

  function initApp() {
    initSidebar();
    var profile = getProfile();

    if (!profile) {
      buildOnboarding();
      showOnboarding();
    } else {
      var overlay = document.getElementById('rp-onboarding-overlay');
      if (overlay) overlay.classList.add('hidden');
      initDashboardContent(profile);
    }

    if (window.lucide) lucide.createIcons();
  }

  /* ── Boot ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGate);
  } else {
    initGate();
  }

})();
