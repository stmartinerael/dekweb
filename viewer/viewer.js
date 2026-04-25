/* dekweb viewer — vanilla JS, no framework */
(function () {
  'use strict';

  // ── Sidebar toggle ──────────────────────────────────────────────────────────
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('toggle-sidebar');
  if (sidebar && toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      toggleBtn.textContent = sidebar.classList.contains('collapsed') ? '☰' : '✕';
    });
  }

  // ── Hash navigation ─────────────────────────────────────────────────────────
  // Sections are anchored as <div id="s42">
  function scrollToSection(num) {
    const el = document.getElementById('s' + num);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleHash() {
    const hash = location.hash.slice(1); // e.g. "s42"
    if (/^s\d+$/.test(hash)) {
      scrollToSection(hash.slice(1));
    }
  }

  window.addEventListener('hashchange', handleHash);
  if (location.hash) handleHash();

  // ── TOC active highlight on scroll ─────────────────────────────────────────
  const tocLinks = Array.from(document.querySelectorAll('#toc a'));
  const sections = Array.from(document.querySelectorAll('.section'));

  if (sections.length && tocLinks.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            tocLinks.forEach(a => {
              a.classList.toggle('active', a.getAttribute('href') === '#' + id);
            });
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );
    sections.forEach(s => observer.observe(s));
  }

  // ── Keyboard shortcuts: n / p for next / previous starred section ───────────
  const starredSections = sections.filter(s => s.classList.contains('starred'));
  let currentStarred = -1;

  function nearestStarredIndex() {
    const scrollY = window.scrollY + window.innerHeight * 0.3;
    let best = 0;
    for (let i = 0; i < starredSections.length; i++) {
      if (starredSections[i].getBoundingClientRect().top + window.scrollY <= scrollY) {
        best = i;
      }
    }
    return best;
  }

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'n') {
      currentStarred = Math.min(nearestStarredIndex() + 1, starredSections.length - 1);
      starredSections[currentStarred]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (e.key === 'p') {
      currentStarred = Math.max(nearestStarredIndex() - 1, 0);
      starredSections[currentStarred]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // ── Search ──────────────────────────────────────────────────────────────────
  const searchInput = document.getElementById('search');
  if (searchInput) {
    // Pre-build a text index: section number → lowercased full text
    const index = sections.map(el => ({
      el,
      text: el.textContent.toLowerCase(),
    }));

    let debounce = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const q = searchInput.value.trim().toLowerCase();
        if (!q) {
          index.forEach(({ el }) => el.style.display = '');
          tocLinks.forEach(a => a.style.display = '');
          return;
        }
        index.forEach(({ el, text }) => {
          const match = text.includes(q);
          el.style.display = match ? '' : 'none';
        });
        // Update TOC to show only matching starred sections
        tocLinks.forEach(a => {
          const href = a.getAttribute('href').slice(1); // "s42"
          const target = document.getElementById(href);
          a.style.display = (!target || target.style.display === 'none') ? 'none' : '';
        });
      }, 150);
    });
  }

  // ── Reporting Mechanism ─────────────────────────────────────────────────────
  const reportBtn = document.createElement('button');
  reportBtn.id = 'report-btn';
  reportBtn.textContent = 'Report Issue';
  document.body.appendChild(reportBtn);

  document.addEventListener('mouseup', (e) => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    if (text && !reportBtn.contains(e.target)) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      reportBtn.style.display = 'block';
      reportBtn.style.top = `${rect.top + window.scrollY - 30}px`;
      reportBtn.style.left = `${rect.left + window.scrollX}px`;
      
      // Store current selection data
      reportBtn._data = {
        selection: text,
        sectionId: selection.anchorNode.parentElement.closest('.section')?.id,
        htmlContext: selection.anchorNode.parentElement.outerHTML,
        url: window.location.href
      };
    } else if (!text) {
      reportBtn.style.display = 'none';
    }
  });

  reportBtn.addEventListener('click', async () => {
    const note = prompt('What is wrong with this rendering?', '');
    if (note === null) return;

    const data = { ...reportBtn._data, note };
    reportBtn.style.display = 'none';
    window.getSelection().removeAllRanges();

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        alert('Report sent! Thank you.');
      } else {
        alert('Failed to send report.');
      }
    } catch (err) {
      console.error(err);
      alert('Error sending report.');
    }
  });
})();

