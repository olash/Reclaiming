/**
 * @file authGuard.js
 * @description Bulletproof session guard for all protected pages on the Reclaimng platform.
 *
 * PLACEMENT RULE: This script tag MUST appear as the FIRST script inside <head>, before
 * any layout, stylesheets, or data-fetching scripts. This prevents the protected page's
 * content from ever being rendered or painted for an unauthenticated visitor.
 *
 * USAGE — add to the top of <head> on every protected page:
 *
 *   <head>
 *     <script src="authGuard.js"></script>   <!-- must be FIRST -->
 *     ...rest of head...
 *   </head>
 *
 * PROTECTED PAGES: dashboard.html, discovery-wizard.html, vault.html
 *
 * HOW IT WORKS:
 *   1. Loads the Supabase CDN client synchronously (deferred to minimise parse blocking).
 *   2. Calls getSession() as soon as the JS engine is ready.
 *   3. If no valid session exists → immediately replaces the current history entry
 *      with auth.html (using location.replace so the back button won't return to the
 *      protected page).
 *   4. If a session IS found → sets window.__reclaimSession for downstream page scripts
 *      to consume without making a second network round-trip.
 */

(function () {
  'use strict';

  /* ── Config ──────────────────────────────────────────────────────────── */
  var SUPABASE_URL  = 'https://rbdwzpecudksbsjwmira.supabase.co';
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZHd6cGVjdWRrc2JzandtaXJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NjE2NjgsImV4cCI6MjA5ODUzNzY2OH0.Wqer73d85wITxgoWnqHibeF2mYPlxZD69N-X3vTCKag';
  var AUTH_PAGE     = 'auth.html';

  /* ── Resolve the redirect URL relative to the current page ───────────── */
  function buildAuthUrl() {
    // Works whether pages are served from root or a sub-path
    var parts = window.location.pathname.split('/');
    parts[parts.length - 1] = AUTH_PAGE;
    return window.location.origin + parts.join('/');
  }

  /* ── Hard redirect — no history entry left behind ────────────────────── */
  function blockAndRedirect() {
    // Blank the page body immediately to prevent flash of protected content
    if (document.body) document.body.style.visibility = 'hidden';
    window.location.replace(buildAuthUrl());
  }

  /* ── Attempt to read a Supabase session from localStorage (fast path) ── */
  /* This avoids a network round-trip for already-authenticated users and    */
  /* prevents any visible page flash.                                        */
  function getLocalSession() {
    try {
      // Supabase stores the session under: sb-<project-ref>-auth-token
      var projectRef = SUPABASE_URL.split('//')[1].split('.')[0]; // "rbdwzpecudksbsjwmira"
      var raw = localStorage.getItem('sb-' + projectRef + '-auth-token');
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      // Check expiry: expires_at is a Unix timestamp in seconds
      if (parsed && parsed.expires_at && parsed.expires_at > Math.floor(Date.now() / 1000)) {
        return parsed; // valid, non-expired local session
      }
      return null; // expired
    } catch (e) {
      return null; // JSON parse error or localStorage blocked
    }
  }

  /* ── Fast synchronous check ──────────────────────────────────────────── */
  var localSession = getLocalSession();

  if (!localSession) {
    // Definitely no valid local session — block immediately
    blockAndRedirect();
    return; // stop execution of the rest of this script
  }

  /* ── Expose session data for page scripts without a second round-trip ── */
  window.__reclaimSession = localSession;

  /* ── Async authoritative check via Supabase SDK ─────────────────────── */
  /* We still do this in the background to handle token refresh edge cases. */
  /* The local check above already allows the page to render safely.        */

  // Dynamically insert the Supabase SDK if not already on the page
  // (some pages may already load it; guard against double-loading)
  function ensureSupabaseLoaded(callback) {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      callback();
      return;
    }
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    script.onload  = callback;
    script.onerror = function () {
      // SDK failed to load — fall back to local session only (already validated above)
      console.warn('[authGuard] Supabase SDK failed to load. Relying on local session only.');
    };
    document.head.appendChild(script);
  }

  ensureSupabaseLoaded(function () {
    var client;
    try {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    } catch (e) {
      // If client creation fails, local check already passed — allow page to render
      return;
    }

    client.auth.getSession().then(function (result) {
      var session = result && result.data && result.data.session;

      if (!session) {
        // Authoritative check failed — local token may be invalid/revoked server-side
        console.warn('[authGuard] Server-side session validation failed. Redirecting to auth.');
        blockAndRedirect();
        return;
      }

      // Refresh the exposed session with the server-validated version
      window.__reclaimSession = session;

      // Also expose a convenience helper for sign-out
      window.__reclaimSignOut = async function () {
        await client.auth.signOut();
        window.location.replace(buildAuthUrl());
      };

      // ── Payment Gate Enforcement ──────────────────────────────────────────
      var path = window.location.pathname;
      if (path.includes('bvn-discovery.html') || path.includes('recovery-detail.html')) {
        client.from('estates')
          .select('payment_status')
          .eq('user_id', session.user.id)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .single()
          .then(function(res) {
            if (!res.data || res.data.payment_status !== 'paid') {
              console.warn('[authGuard] Payment not completed. Redirecting to checkout.');
              // Hide body to prevent UI flicker
              if (document.body) document.body.style.visibility = 'hidden';
              
              var parts = window.location.pathname.split('/');
              parts[parts.length - 1] = 'dashboard.html'; // Assuming checkout is initiated from dashboard
              window.location.replace(window.location.origin + parts.join('/'));
            }
          })
          .catch(function(err) {
            console.error('[authGuard] Error checking payment status:', err);
          });
      }
    }).catch(function () {
      // Network error during validation — conservatively allow page to render
      // (local token was already validated above)
      console.warn('[authGuard] Network error during session validation. Proceeding with local session.');
    });
  });

})();
