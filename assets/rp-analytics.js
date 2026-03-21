// RegulatorPulse Analytics — zero-friction behavioral signal collection
(function() {
  'use strict';

  var ENDPOINT = '/api/feedback';
  var SESSION_ID_KEY = 'rp_session_id';

  function getSessionId() {
    var id = sessionStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      sessionStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  }

  function getUserId() {
    try {
      var profile = JSON.parse(localStorage.getItem('rp_profile') || '{}');
      return profile.email || profile.businessName || 'anon_' + getSessionId();
    } catch(e) { return 'anon_' + getSessionId(); }
  }

  function trackEvent(data) {
    data.product = 'regulatorpulse';
    data.userId = getUserId();
    data.sessionId = getSessionId();
    data.timestamp = new Date().toISOString();
    data.page = window.location.pathname;

    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, JSON.stringify(data));
    } else {
      fetch(ENDPOINT, { method: 'POST', body: JSON.stringify(data), keepalive: true }).catch(function(){});
    }

    var log = JSON.parse(localStorage.getItem('rp_analytics_log') || '[]');
    log.push(data);
    if (log.length > 100) log = log.slice(-100);
    localStorage.setItem('rp_analytics_log', JSON.stringify(log));
  }

  // Dwell time
  function initDwellTracking() {
    if (!window.IntersectionObserver) return;
    var enterTimes = {};
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        var el = entry.target;
        var itemId = el.dataset.itemId || el.id;
        if (!itemId) return;
        if (entry.isIntersecting) {
          enterTimes[itemId] = Date.now();
        } else if (enterTimes[itemId]) {
          var dwell = Date.now() - enterTimes[itemId];
          if (dwell > 3000 && dwell < 300000) {
            trackEvent({ type: 'dwell', itemId: itemId, dwellMs: dwell });
          }
          delete enterTimes[itemId];
        }
      });
    }, { threshold: 0.5 });

    function observeItems() {
      document.querySelectorAll('.rp-alert-item, .rp-intel-item, .rp-headline-item, .rp-tip, [data-trackable]').forEach(function(el) {
        observer.observe(el);
      });
    }
    observeItems();
    var mo = new MutationObserver(function() { setTimeout(observeItems, 500); });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // Session tracking
  function initSessionTracking() {
    var start = Date.now();
    var count = parseInt(localStorage.getItem('rp_session_count') || '0') + 1;
    localStorage.setItem('rp_session_count', count.toString());

    trackEvent({ type: 'session_start', referrer: document.referrer, sessionNumber: count });

    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') {
        trackEvent({ type: 'session_end', durationMs: Date.now() - start });
      }
    });
  }

  // Scroll depth
  function initScrollTracking() {
    var milestones = [25, 50, 75, 100];
    var fired = {};
    var scrollTimer;
    window.addEventListener('scroll', function() {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function() {
        var pct = Math.round((window.pageYOffset / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
        milestones.forEach(function(m) {
          if (pct >= m && !fired[m]) {
            fired[m] = true;
            trackEvent({ type: 'scroll_depth', depth: m });
          }
        });
      }, 300);
    });
  }

  // Click tracking
  function initClickTracking() {
    document.addEventListener('click', function(e) {
      var alert = e.target.closest('.rp-alert-item, [data-trackable]');
      if (alert) {
        trackEvent({ type: 'item_click', itemId: alert.dataset.itemId || alert.id, section: 'alerts' });
      }
      var intel = e.target.closest('.rp-intel-item');
      if (intel) {
        trackEvent({ type: 'item_click', itemId: intel.dataset.itemId || intel.id, section: 'intel' });
      }
      var nav = e.target.closest('.rp-nav-item, nav a');
      if (nav) {
        trackEvent({ type: 'nav_click', section: nav.textContent.trim() });
      }
    });
  }

  // "This affects me" button on alert items
  function initRelevanceButtons() {
    var RELEVANCE_KEY = 'rp_relevance';
    var relevance = JSON.parse(localStorage.getItem(RELEVANCE_KEY) || '{}');

    function addButtons() {
      document.querySelectorAll('.rp-alert-item, [data-trackable]').forEach(function(item) {
        if (item.querySelector('.rp-relevance-btn')) return;
        var itemId = item.dataset.itemId || item.id;
        if (!itemId) return;

        var btn = document.createElement('button');
        btn.className = 'rp-relevance-btn';
        btn.textContent = relevance[itemId] ? '✓ Affects my business' : '⚑ This affects me';
        btn.style.cssText = 'background:none;border:1px solid ' + (relevance[itemId] ? 'rgba(46,207,163,0.5)' : 'rgba(255,255,255,0.15)') + ';border-radius:4px;padding:3px 10px;cursor:pointer;font-size:11px;color:' + (relevance[itemId] ? '#2ecfa3' : 'rgba(255,255,255,0.5)') + ';margin-top:6px;transition:all 0.2s;';

        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          relevance[itemId] = !relevance[itemId];
          localStorage.setItem(RELEVANCE_KEY, JSON.stringify(relevance));
          this.textContent = relevance[itemId] ? '✓ Affects my business' : '⚑ This affects me';
          this.style.borderColor = relevance[itemId] ? 'rgba(46,207,163,0.5)' : 'rgba(255,255,255,0.15)';
          this.style.color = relevance[itemId] ? '#2ecfa3' : 'rgba(255,255,255,0.5)';
          trackEvent({ type: 'relevance', itemId: itemId, relevant: relevance[itemId] });
        });

        item.appendChild(btn);
      });
    }

    addButtons();
    var mo = new MutationObserver(function() { setTimeout(addButtons, 500); });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    initSessionTracking();
    initDwellTracking();
    initScrollTracking();
    initClickTracking();
    initRelevanceButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.rpAnalytics = { trackEvent: trackEvent };
})();
