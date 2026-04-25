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

  // ── Graph view ──────────────────────────────────────────────────────────────
  const graphOverlay = document.getElementById('graph-overlay');
  const toggleGraphBtn = document.getElementById('toggle-graph');
  const graphCloseBtn = document.getElementById('graph-close');
  const graphSvgEl = document.getElementById('graph-svg');

  let d3Loaded = false;

  function loadD3() {
    return new Promise((resolve) => {
      if (d3Loaded) { resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js';
      s.onload = () => { d3Loaded = true; resolve(); };
      document.head.appendChild(s);
    });
  }

  function renderGraph() {
    const data = window.__GRAPH_DATA__;
    if (!data || !graphSvgEl) return;

    const width = graphSvgEl.clientWidth;
    const height = graphSvgEl.clientHeight;

    // Resolve CSS variable colours for use in D3 (which doesn't read CSS vars on SVG attrs)
    const style = getComputedStyle(document.documentElement);
    const colLink = style.getPropertyValue('--link').trim();
    const colRule = style.getPropertyValue('--rule').trim();
    const colInk  = style.getPropertyValue('--ink').trim();
    const colPaper = style.getPropertyValue('--paper').trim();
    const colInkLight = style.getPropertyValue('--ink-light').trim();

    d3.select(graphSvgEl).selectAll('*').remove();

    const svg = d3.select(graphSvgEl)
      .call(d3.zoom().scaleExtent([0.05, 6]).on('zoom', (e) => {
        g.attr('transform', e.transform);
      }));

    const g = svg.append('g');

    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -3 6 6')
      .attr('refX', 15).attr('refY', 0)
      .attr('markerWidth', 5).attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-3L6,0L0,3')
      .attr('fill', colRule);

    // Deep-clone nodes/edges so D3 can mutate them for simulation
    const nodes = data.nodes.map(d => ({ ...d }));
    const edges = data.edges.map(d => ({ ...d }));

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges).id(d => d.id).distance(55).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(13));

    const link = g.append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', colRule)
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.7)
      .attr('marker-end', 'url(#arrowhead)');

    const nodeGroup = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .on('click', (e, d) => {
        graphOverlay.hidden = true;
        const target = document.getElementById(d.id);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
      .call(
        d3.drag()
          .on('start', (e, d) => {
            if (!e.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
          .on('end', (e, d) => {
            if (!e.active) simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      );

    nodeGroup.append('circle')
      .attr('r', d => d.starred ? 9 : 5)
      .attr('fill', d => d.starred ? colLink : colPaper)
      .attr('stroke', d => d.starred ? colLink : colRule)
      .attr('stroke-width', d => d.starred ? 0 : 1.5);

    // Chapter labels
    nodeGroup.filter(d => d.starred).append('text')
      .attr('dy', '0.35em')
      .attr('x', 12)
      .attr('font-size', '10px')
      .attr('font-family', 'Inter, sans-serif')
      .attr('fill', colInk)
      .attr('pointer-events', 'none')
      .text(d => d.title ? `§${d.num} ${d.title}` : `§${d.num}`);

    // Tooltip for all nodes
    nodeGroup.append('title')
      .text(d => d.title ? `§${d.num}: ${d.title}` : `§${d.num}`);

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      nodeGroup.attr('transform', d => `translate(${d.x},${d.y})`);
    });
  }

  if (toggleGraphBtn && graphOverlay) {
    toggleGraphBtn.addEventListener('click', async () => {
      graphOverlay.hidden = false;
      await loadD3();
      renderGraph();
    });
    graphCloseBtn?.addEventListener('click', () => { graphOverlay.hidden = true; });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !graphOverlay.hidden) graphOverlay.hidden = true;
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

