/* ==========================================================================
   LEE SINYANG — Architecture Portfolio
   script.js : 首頁輪播（5 秒自動淡入切換 / 手動控制 / 點擊跳轉）
               專案內頁（?id=1~6 讀取資料 / 十頁縱向滑動 / 進場淡入）
   ========================================================================== */
(function () {
  'use strict';

  const FORMSPREE_ENDPOINT = 'https://formspree.io/f/myeyqvvw';

  /* ------------------------------------------------------------------
     1. 專案資料（共 6 件，每件 10 張圖面）
        圖片路徑：images/p{id}-{1..10}.jpg
     ------------------------------------------------------------------ */
  var PROJECTS = {
    1: {
      cn: '都市漫遊者企劃', en: 'TEEMING CAVITY', grade: 'Junior',
      sheets: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']
    },
    2: {
      cn: '閭巷囊體', en: 'EVERYDAY BLOCK', grade: 'Junior',
      sheets: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']
    },
    3: {
      cn: '海線物語', en: 'EPHEMERAL-MASS', grade: 'Sophomore',
      sheets: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']
    },
    4: {
      cn: '居住身體與都市身體', en: 'SLIT OCULUS', grade: 'Sophomore',
      sheets: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']
    },
    5: {
      cn: '室內·視外·室外·視內', en: '[ IN ] SIGHT · OUT  [ OUT ] SITE · IN', grade: 'Freshman',
      sheets: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']
    },
    6: {
      cn: '之間', en: 'BETWEEN', grade: 'Freshman',
      sheets: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']
    }
  };

  var AUTOPLAY = 5000;   // 首頁 5 秒自動切換
  var SHEETS   = 10;     // 內頁十頁

  /* ------------------------------------------------------------------
     2. 小工具
     ------------------------------------------------------------------ */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* 缺圖時以極簡佔位框取代，避免破圖圖示破壞畫面。
     一旦圖片曾經成功 load 過（dataset.loaded），就永遠不再被取代——
     確保圖片載入完成後不會被任何後續誤判事件覆蓋掉。 */
  function placeholder(img) {
    if (img.dataset.fallbackDone || img.dataset.loaded || !img.parentNode) { return; }
    img.dataset.fallbackDone = '1';
    var box = document.createElement('div');
    box.className = 'fig-missing';
    box.textContent = img.getAttribute('src');
    img.parentNode.replaceChild(box, img);
  }

  /* skipSyncCheck：剛用 JS 動態設定 src 的圖片，若瀏覽器已有快取，
     img.complete 可能搶先同步變 true，但 naturalWidth 還沒跟上，
     會被誤判成「破圖」而整個 <img> 被拔掉——這正是手機封面「短暫出現又消失」的成因。
     這種情況只掛 load / error 監聽，不做當下的同步判斷。 */
  function watchImage(img, skipSyncCheck) {
    if (!img || img.dataset.src) { return; }
    img.addEventListener('load', function () { img.dataset.loaded = '1'; });
    if (!skipSyncCheck && img.complete && img.naturalWidth === 0) {
      placeholder(img);
    } else {
      img.addEventListener('error', function () { placeholder(img); });
    }
  }

  function watchImages(root) {
    $$('img', root).forEach(function (img) { watchImage(img, false); });
  }

  /* 手機端效能優化：將 data-src 轉為真正的 src，延遲到真正需要時才發出請求 */
  function hydrateImage(img) {
    if (!img || !img.dataset.src) { return; }
    img.src = img.dataset.src;
    delete img.dataset.src;
    watchImage(img, true);   // 剛設定 src，跳過同步檢查，避免快取命中造成的誤判
    if (img.complete && img.naturalWidth > 0) {
      img.dataset.loaded = '1';   // 圖片已在瀏覽器快取中，同步命中時立即標記完成
    }
  }

  /* ==================================================================
     3. 首頁：輪播
     ================================================================== */
  function initHome() {
    var slides = $$('.slide', $('#slides'));
    if (!slides.length) { return; }

    var progress   = $('#progress');
    var counterCur = $('#counterCur');
    var prevBtn    = $('#prevBtn');
    var nextBtn    = $('#nextBtn');

    var index = 0;
    var timer = null;
    var paused = false;

    /* --- 手機封面：只優先載入目前＋前後各一張，其餘延遲到輪播到達前才載入 --- */
    var slideImgs = slides.map(function (s) { return $('img', s); });
    var isMobile = window.matchMedia('(max-width: 768px)').matches;

    function hydrateAround(i) {
      hydrateImage(slideImgs[i]);
      hydrateImage(slideImgs[(i + 1) % slides.length]);
      hydrateImage(slideImgs[(i - 1 + slides.length) % slides.length]);
    }

    /* ±1 視窗只保證「下一步」來得及載入，但使用者快速連續滑動／點擊時
       （例如短時間內連續切換好幾張）會跳過中間的預抓步驟，導致某張封面
       （例如封面 5）切到時圖片仍在下載中而短暫顯示空白。
       用 requestIdleCallback／setTimeout 在首屏繪製後，於背景把其餘所有
       封面都排入低優先權下載，從根本消除「切到時還沒開始抓」的競速問題。 */
    function hydrateAllIdle() {
      var schedule = window.requestIdleCallback || function (cb) { return setTimeout(cb, 300); };
      schedule(function () { slideImgs.forEach(hydrateImage); });
    }

    if (isMobile) {
      hydrateAround(0);                 // 首屏封面優先，鄰近兩張立即預抓
      hydrateAllIdle();                 // 其餘封面背景預抓，避免快速切換時競速
    } else {
      slideImgs.forEach(hydrateImage);  // 桌機：維持原本立即全載入、高清不變
    }

    /* --- 建立進度線 --- */
    var dots = slides.map(function (slide, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dot';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-label', '第 ' + (i + 1) + ' 件作品');
      btn.innerHTML = '<span class="dot-fill"></span>';
      btn.addEventListener('click', function () { goTo(i, true); });
      progress.appendChild(btn);
      return btn;
    });

    /* --- 切換 --- */
    function goTo(next, manual) {
      next = (next + slides.length) % slides.length;

      slides.forEach(function (s, i) {
        var on = (i === next);
        s.classList.toggle('is-active', on);
        s.setAttribute('aria-hidden', on ? 'false' : 'true');
      });

      dots.forEach(function (d, i) {
        d.classList.remove('is-active');
        d.setAttribute('aria-selected', i === next ? 'true' : 'false');
      });

      /* 重新啟動進度線動畫 */
      var fill = $('.dot-fill', dots[next]);
      fill.style.animation = 'none';
      void fill.offsetWidth;          // 強制 reflow
      fill.style.animation = '';
      dots[next].classList.add('is-active');
      dots[next].classList.toggle('is-paused', paused);

      counterCur.textContent = pad2(next + 1);
      index = next;

      if (isMobile) { hydrateAround(next); }

      /* 診斷：若切到的封面圖尚未載入完成，留下記錄以便追查是哪一張、
         發生在哪個時間點——不影響顯示，圖片仍會在載入完成後立即補上 */
      var activeImg = slideImgs[next];
      if (activeImg && !activeImg.dataset.loaded && !(activeImg.complete && activeImg.naturalWidth > 0)) {
        console.warn(
          '[Carousel] Slide ' + (next + 1) + ' (data-id=' + slides[next].dataset.id + ', ' +
          (activeImg.currentSrc || activeImg.src || activeImg.dataset.src) + ') became active before its cover image finished loading.'
        );
      }

      if (manual) { restart(); }
    }

    function nextSlide() { goTo(index + 1, false); }
    function prevSlide() { goTo(index - 1, true); }

    function restart() {
      clearInterval(timer);
      if (!paused) { timer = setInterval(nextSlide, AUTOPLAY); }
    }

    function setPaused(state) {
      paused = state;
      dots.forEach(function (d) { d.classList.toggle('is-paused', state); });
      if (state) { clearInterval(timer); } else { restart(); }
    }

    /* --- 控制項 --- */
    nextBtn.addEventListener('click', function () { goTo(index + 1, true); });
    prevBtn.addEventListener('click', prevSlide);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { goTo(index + 1, true); }
      if (e.key === 'ArrowLeft')  { prevSlide(); }
    });

    /* 分頁切到背景時暫停，回來再續播 */
    document.addEventListener('visibilitychange', function () {
      setPaused(document.hidden);
    });

    /* 手機左右滑動 */
    var touchX = null;
    var slidesBox = $('#slides');
    slidesBox.addEventListener('touchstart', function (e) {
      touchX = e.changedTouches[0].clientX;
    }, { passive: true });
    slidesBox.addEventListener('touchend', function (e) {
      if (touchX === null) { return; }
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 45) { dx < 0 ? goTo(index + 1, true) : prevSlide(); }
      touchX = null;
    }, { passive: true });

    watchImages(document);
    goTo(0, false);
    restart();
  }

  /* ==================================================================
     4. 專案內頁：依 ?id=X 建立十頁
     ================================================================== */
  function initProject() {
    var params = new URLSearchParams(window.location.search);
    var id = parseInt(params.get('id'), 10);
    if (!PROJECTS[id]) { id = 1; }

    var data  = PROJECTS[id];
    var sheetsBox = $('#sheets');

    /* 手機端效能優化：只有第 1、2 張圖立即載入，其餘延遲到捲動／點擊到達前才發出請求 */
    var lazyMode     = window.matchMedia('(max-width: 768px)').matches;
    var mobileQuery  = window.matchMedia('(max-width: 640px)');   // 原地畫冊模式（與 CSS 斷點一致）

    /* --- 標頭 --- */
    document.title = data.cn + ' ' + data.en + ' — 李心樣 LEE SINYANG';
    $('#projTitleCn').textContent = data.cn;
    $('#projTitleEn').textContent = data.en;
    $('#projMeta').textContent    = data.grade;

    /* --- 十頁 --- */
    var frag = document.createDocumentFragment();

    for (var i = 1; i <= SHEETS; i++) {
      var sec = document.createElement('section');
      sec.className = 'sheet';
      sec.id = 'sheet-' + pad2(i);
      sec.dataset.index = String(i);

      var fig = document.createElement('figure');
      fig.className = 'sheet-fig';

      var img = document.createElement('img');
      var src = 'images/p' + id + '-' + i + '.jpg';
      if (lazyMode && i > 2) {
        img.dataset.src = src;          // 延遲載入：捲動／點擊到達前才 hydrate
      } else {
        img.src = src;
        if (i === 1) { img.setAttribute('fetchpriority', 'high'); }
      }
      img.alt = data.en + ' — ' + data.sheets[i - 1];
      img.loading = (i > 2) ? 'lazy' : 'eager';
      img.decoding = 'async';
      fig.appendChild(img);

      var cap = document.createElement('figcaption');
      cap.className = 'sheet-cap';
      var sheetLabel = data.sheets[i - 1];
      cap.innerHTML =
        '<span class="num">' + pad2(i) + ' / ' + SHEETS + '</span>' +
        (sheetLabel && sheetLabel !== pad2(i)
          ? '<span class="txt">' + sheetLabel + '</span>'
          : '');

      sec.appendChild(fig);
      sec.appendChild(cap);

      /* 第一頁附上簡短說明（若有提供） */
      if (i === 1 && data.note) {
        var note = document.createElement('p');
        note.className = 'sheet-note';
        note.textContent = data.note;
        sec.appendChild(note);
      }

      frag.appendChild(sec);
    }

    sheetsBox.appendChild(frag);

    var sections = $$('.sheet', sheetsBox);

    /* --- 右側導覽細線 --- */
    var railTicks = $('#railTicks');
    var railNum   = $('#railNum');

    var ticks = sections.map(function (sec, i) {
      var t = document.createElement('button');
      t.type = 'button';
      t.className = 'tick';
      t.setAttribute('aria-label', '前往第 ' + pad2(i + 1) + ' 頁');
      t.addEventListener('click', function () {
        sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      railTicks.appendChild(t);
      return t;
    });

    function setCurrent(i) {
      ticks.forEach(function (t, n) { t.classList.toggle('is-current', n === i); });
      railNum.textContent = pad2(i + 1);
    }

    /* --- 進場淡入 + 目前頁碼 --- */
    if ('IntersectionObserver' in window) {
      var fadeIn = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add('is-visible');
            /* 640~768px 區間仍是桌機式捲動版面，捲到哪一頁就 hydrate 哪一頁；
               原地畫冊模式（≤640px）改由 showSheet() 依點擊/滑動精準 hydrate，這裡略過 */
            if (lazyMode && !mobileQuery.matches) {
              hydrateImage($('img', en.target));
            }
          }
        });
      }, { threshold: 0.18 });

      var current = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            setCurrent(parseInt(en.target.dataset.index, 10) - 1);
          }
        });
      }, { threshold: 0.5 });

      sections.forEach(function (sec) {
        fadeIn.observe(sec);
        current.observe(sec);
      });
    } else {
      sections.forEach(function (sec) { sec.classList.add('is-visible'); });
    }

    setCurrent(0);
    watchImages(sheetsBox);

    /* --- 手機版：原地畫冊切換模式（Tap / Swipe to Navigate） --- */
    var currentIndex = 0;

    function showSheet(next) {
      next = Math.max(0, Math.min(sections.length - 1, next));
      sections.forEach(function (sec, n) {
        var on = (n === next);
        sec.classList.toggle('is-current', on);
        if (on) { sec.classList.add('is-visible'); }
      });
      currentIndex = next;
      setCurrent(currentIndex);

      /* 預先加載前後各一張，切換更順暢，其餘頁面維持延遲載入 */
      hydrateImage($('img', sections[next]));
      if (sections[next - 1]) { hydrateImage($('img', sections[next - 1])); }
      if (sections[next + 1]) { hydrateImage($('img', sections[next + 1])); }
    }

    sheetsBox.addEventListener('click', function (e) {
      if (!mobileQuery.matches) { return; }
      var rect = sheetsBox.getBoundingClientRect();
      var tappedRight = (e.clientX - rect.left) > rect.width / 2;
      showSheet(currentIndex + (tappedRight ? 1 : -1));
    });

    var pTouchX = null;
    sheetsBox.addEventListener('touchstart', function (e) {
      if (!mobileQuery.matches) { return; }
      pTouchX = e.changedTouches[0].clientX;
    }, { passive: true });
    sheetsBox.addEventListener('touchend', function (e) {
      if (!mobileQuery.matches || pTouchX === null) { return; }
      var dx = e.changedTouches[0].clientX - pTouchX;
      if (Math.abs(dx) > 40) { showSheet(currentIndex + (dx < 0 ? 1 : -1)); }
      pTouchX = null;
    }, { passive: true });

    if (mobileQuery.matches) { showSheet(0); }
    (mobileQuery.addEventListener ? mobileQuery.addEventListener.bind(mobileQuery, 'change')
      : mobileQuery.addListener.bind(mobileQuery))(function (e) {
      if (e.matches) {
        showSheet(currentIndex);
      } else {
        sections.forEach(function (sec) { sec.classList.remove('is-current'); });
      }
    });
  }

  /* ==================================================================
     5. 互動：愛心按鈕 + 留言板（Formspree）
     ================================================================== */
  /* Formspree 標準 AJAX 寫法：POST + Accept/Content-Type 皆為 application/json，
     回傳原始 Response，由呼叫端自行判斷 response.ok。 */
  function postToFormspree(payload) {
    return fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  }

  function logFormspreeError(context, response) {
    response.json().catch(function () { return null; }).then(function (data) {
      console.log('[Formspree] ' + context + ' failed —', response.status, data);
    });
  }

  function initHeart() {
    var btn = $('#heartBtn');
    if (!btn) { return; }

    btn.addEventListener('click', function () {
      btn.classList.remove('is-liked');
      void btn.offsetWidth;              // 強制 reflow，讓動畫可重複播放
      btn.classList.add('is-liked');

      postToFormspree({ message: 'Someone gave a heart to your portfolio!' })
        .then(function (response) {
          if (!response.ok) { logFormspreeError('heart like', response); }
        })
        .catch(function (err) { console.log('[Formspree] heart like network error:', err); });
    });
  }

  function initContact() {
    var toggle = $('#contactToggle');
    var panel  = $('#contactPanel');
    var form   = $('#contactForm');
    if (!toggle || !panel || !form) { return; }

    var status  = $('#sendStatus');
    var sendBtn = $('.send-btn', form);

    toggle.addEventListener('click', function () {
      var open = panel.classList.toggle('is-open');
      toggle.textContent = open ? '— CLOSE' : '+ CONTACT';
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    function showStatus(text, ms) {
      status.textContent = text;
      status.classList.add('is-visible');
      setTimeout(function () { status.classList.remove('is-visible'); }, ms);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var memo    = form.message.value.trim();
      var visitor = form.visitor.value.trim();
      if (!memo) { form.message.focus(); return; }

      sendBtn.disabled = true;
      sendBtn.textContent = 'SENDING...';

      postToFormspree({
        email: visitor || 'visitor@portfolio.com',
        message: memo
      }).then(function (response) {
        if (response.ok) {
          form.reset();
          showStatus('SENT WITH THANKS', 2000);
          setTimeout(function () {
            sendBtn.disabled = false;
            sendBtn.textContent = 'SEND';
          }, 2000);
        } else {
          logFormspreeError('memo', response);
          showStatus('SOMETHING WENT WRONG', 2500);
          sendBtn.disabled = false;
          sendBtn.textContent = 'SEND';
        }
      }).catch(function (err) {
        console.log('[Formspree] memo network error:', err);
        showStatus('SOMETHING WENT WRONG', 2500);
        sendBtn.disabled = false;
        sendBtn.textContent = 'SEND';
      });
    });
  }

  /* ==================================================================
     6. 啟動
     ================================================================== */
  function boot() {
    if (document.body.classList.contains('page-home'))    { initHome(); initHeart(); initContact(); }
    if (document.body.classList.contains('page-project')) { initProject(); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
