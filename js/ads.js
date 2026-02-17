// =========================
// FILE: /js/ads.js
// PURPOSE: Safe AdSense Native (In-Article / Fluid) insertion
// CLIENT: ca-pub-5368831813847678
// SLOT:   2425254569
// =========================

(function () {
  "use strict";

  const CLIENT_ID = "ca-pub-5368831813847678";
  const DEFAULT_SLOT_ID = "2425254569";

  // internal flags
  let scriptLoaded = false;

  // -------------------------
  // Helpers
  // -------------------------
  function log(...args) {
    // toggle to true if you want debugging
    const DEBUG = false;
    if (DEBUG) console.log("[Ads]", ...args);
  }

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function qsa(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function insertAfter(targetEl, newEl) {
    if (!targetEl || !targetEl.parentNode) return false;
    targetEl.parentNode.insertBefore(newEl, targetEl.nextSibling);
    return true;
  }

  // Very simple heuristic to avoid ads on thin/empty pages
  function pageHasEnoughText(minChars = 350) {
    const t = (document.body && document.body.innerText) ? document.body.innerText.trim() : "";
    return t.length >= minChars;
  }

  function loadAdsenseScriptOnce() {
    if (scriptLoaded) return;

    // If already present in DOM, mark loaded and return
    const existing = qsa('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]');
    if (existing.length > 0) {
      scriptLoaded = true;
      return;
    }

    const s = document.createElement("script");
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT_ID}`;
    s.crossOrigin = "anonymous";
    document.head.appendChild(s);

    scriptLoaded = true;
  }

  function buildNativeInArticleAd(slotId = DEFAULT_SLOT_ID) {
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.cssText = "display:block; text-align:center;";
    ins.setAttribute("data-ad-layout", "in-article");
    ins.setAttribute("data-ad-format", "fluid");
    ins.setAttribute("data-ad-client", CLIENT_ID);
    ins.setAttribute("data-ad-slot", slotId);
    return ins;
  }

  function pushAdsbygoogleSafe() {
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
      return true;
    } catch (e) {
      return false;
    }
  }

  function alreadyHasAdNear(element, radiusPx = 250) {
    // Prevent stacking ads too close.
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const ads = qsa("ins.adsbygoogle");
    for (const ad of ads) {
      const r = ad.getBoundingClientRect();
      const dy = Math.abs((r.top + r.bottom) / 2 - (rect.top + rect.bottom) / 2);
      if (dy < radiusPx) return true;
    }
    return false;
  }

  // -------------------------
  // Gatekeeping: when ads are allowed
  // -------------------------
  function canShowAds(options = {}) {
    const {
      loading = false,
      error = false,
      minItems = 0,
      minItemsRequired = 3,
      minBodyTextChars = 350
    } = options;

    if (loading) {
      log("Blocked: still loading");
      return false;
    }
    if (error) {
      log("Blocked: error state");
      return false;
    }
    if (typeof minItems === "number" && minItems < minItemsRequired) {
      log("Blocked: not enough items", minItems, "required", minItemsRequired);
      return false;
    }
    if (!pageHasEnoughText(minBodyTextChars)) {
      log("Blocked: page text too low");
      return false;
    }

    return true;
  }

  // -------------------------
  // Public placement functions
  // -------------------------

  /**
   * Insert a native ad after the Nth "card" inside a container.
   *
   * Example:
   * Ads.insertAdAfterNthCard({
   *   containerSelector: "#more-for-you",
   *   cardSelector: ".more-card",
   *   n: 4
   * });
   */
  function insertAdAfterNthCard(opts = {}) {
    const {
      containerSelector,
      cardSelector,
      n = 3,
      slotId = DEFAULT_SLOT_ID
    } = opts;

    const container = qs(containerSelector);
    if (!container) {
      log("No container found:", containerSelector);
      return false;
    }

    const cards = qsa(cardSelector, container);
    if (!cards.length || cards.length < n) {
      log("Not enough cards:", cards.length, "need:", n);
      return false;
    }

    const target = cards[n - 1];
    if (alreadyHasAdNear(target)) {
      log("Ad already near target (skipping)");
      return false;
    }

    loadAdsenseScriptOnce();

    const ad = buildNativeInArticleAd(slotId);
    const ok = insertAfter(target, ad);
    if (!ok) return false;

    // Delay push slightly so DOM is settled
    setTimeout(() => pushAdsbygoogleSafe(), 250);
    return true;
  }

  /**
   * Insert a native ad after the Nth paragraph inside an article body.
   *
   * Example:
   * Ads.insertAdAfterParagraph({
   *   articleBodySelector: "#article-body",
   *   paragraphNumber: 3
   * });
   */
  function insertAdAfterParagraph(opts = {}) {
    const {
      articleBodySelector,
      paragraphNumber = 3,
      slotId = DEFAULT_SLOT_ID,
      minParagraphsRequired = 5
    } = opts;

    const body = qs(articleBodySelector);
    if (!body) {
      log("No article body found:", articleBodySelector);
      return false;
    }

    const paragraphs = qsa("p", body).filter(p => (p.innerText || "").trim().length > 30);
    if (paragraphs.length < minParagraphsRequired) {
      log("Not enough paragraphs:", paragraphs.length, "need:", minParagraphsRequired);
      return false;
    }
    if (paragraphs.length < paragraphNumber) {
      log("Paragraph number out of range:", paragraphNumber, "total:", paragraphs.length);
      return false;
    }

    const target = paragraphs[paragraphNumber - 1];
    if (alreadyHasAdNear(target)) {
      log("Ad already near paragraph target (skipping)");
      return false;
    }

    loadAdsenseScriptOnce();

    const ad = buildNativeInArticleAd(slotId);
    const ok = insertAfter(target, ad);
    if (!ok) return false;

    setTimeout(() => pushAdsbygoogleSafe(), 250);
    return true;
  }

  /**
   * Insert a native ad inside a container at a specific child index.
   * Useful if you have a grid of categories and you want an ad after category 2, etc.
   *
   * Example:
   * Ads.insertAdIntoContainer({
   *   containerSelector: "#categories-grid",
   *   childIndexAfter: 2
   * });
   */
  function insertAdIntoContainer(opts = {}) {
    const {
      containerSelector,
      childIndexAfter = 2,
      slotId = DEFAULT_SLOT_ID
    } = opts;

    const container = qs(containerSelector);
    if (!container) return false;

    const kids = Array.from(container.children);
    if (kids.length <= childIndexAfter) return false;

    const target = kids[childIndexAfter];
    if (alreadyHasAdNear(target)) return false;

    loadAdsenseScriptOnce();

    const ad = buildNativeInArticleAd(slotId);
    const ok = insertAfter(target, ad);
    if (!ok) return false;

    setTimeout(() => pushAdsbygoogleSafe(), 250);
    return true;
  }

  /**
   * Convenience: call this once after your content render is complete.
   * It will check policy-safe conditions first.
   *
   * Example:
   * Ads.runWhenReady({
   *   loading: false,
   *   error: false,
   *   minItems: articles.length,
   *   placements: () => {
   *     Ads.insertAdAfterNthCard({...});
   *   }
   * });
   */
  function runWhenReady(opts = {}) {
    const {
      loading = false,
      error = false,
      minItems = 0,
      minItemsRequired = 3,
      minBodyTextChars = 350,
      placements
    } = opts;

    const allowed = canShowAds({ loading, error, minItems, minItemsRequired, minBodyTextChars });
    if (!allowed) return false;

    if (typeof placements === "function") {
      placements();
      return true;
    }
    return false;
  }

  // -------------------------
  // Export to window for simple usage from plain HTML/JS
  // -------------------------
  window.Ads = {
    CLIENT_ID,
    DEFAULT_SLOT_ID,

    // gating
    canShowAds,
    runWhenReady,

    // placements
    insertAdAfterNthCard,
    insertAdAfterParagraph,
    insertAdIntoContainer
  };
})();
