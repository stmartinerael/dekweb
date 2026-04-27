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
    const cx = width / 2, cy = height / 2;

    const styleVars = getComputedStyle(document.documentElement);
    const colInk   = styleVars.getPropertyValue('--ink').trim();
    const colPaper = styleVars.getPropertyValue('--paper').trim();
    const colRule  = styleVars.getPropertyValue('--rule').trim();

    // Muted, warm-toned palette — one colour per chapter
    const PALETTE = [
      '#4878a8','#b87040','#50966e','#9060a0',
      '#c07830','#4a7fb8','#789040','#a84868',
      '#509090','#a06828',
    ];
    const chapterColor = (i) => PALETTE[i % PALETTE.length];

    // ── Chapter membership ────────────────────────────────────────────────────
    // Walk nodes in section order; each non-starred node belongs to the last
    // starred node that preceded it.
    const chapters = data.nodes.filter(n => n.starred);
    const chapterIdx = new Map();  // nodeId → chapter index
    let curChIdx = 0;
    for (const node of data.nodes) {
      if (node.starred) curChIdx = chapters.findIndex(c => c.id === node.id);
      chapterIdx.set(node.id, Math.max(0, curChIdx));
    }

    // ── Node degree (for radius scaling) ─────────────────────────────────────
    const degree = new Map(data.nodes.map(n => [n.id, 0]));
    for (const e of data.edges) {
      degree.set(e.source, (degree.get(e.source) || 0) + 1);
      degree.set(e.target, (degree.get(e.target) || 0) + 1);
    }
    const maxDeg = Math.max(...degree.values(), 1);
    const nodeR = (d) => d.starred ? 9 : 4 + (degree.get(d.id) || 0) / maxDeg * 4;

    // ── Pre-position: chapters on a ring, sections scattered near their chapter ─
    const ringR = Math.min(width, height) * 0.30;
    const chapterPos = chapters.map((_, i) => {
      const angle = (2 * Math.PI * i / chapters.length) - Math.PI / 2;
      return { x: cx + ringR * Math.cos(angle), y: cy + ringR * Math.sin(angle) };
    });
    const jitter = () => (Math.random() - 0.5) * 55;
    const nodes = data.nodes.map(d => {
      const ci = chapterIdx.get(d.id) ?? 0;
      const cp = chapterPos[ci] || { x: cx, y: cy };
      return { ...d, x: cp.x + jitter(), y: cp.y + jitter() };
    });
    // Preserve original string IDs before D3's forceLink replaces them with refs
    const edges = data.edges.map(d => ({
      ...d, _src: d.source, _tgt: d.target,
    }));

    // ── SVG setup ─────────────────────────────────────────────────────────────
    d3.select(graphSvgEl).selectAll('*').remove();
    const zoomBehavior = d3.zoom().scaleExtent([0.04, 8]).on('zoom', e => g.attr('transform', e.transform));
    const svg = d3.select(graphSvgEl).call(zoomBehavior);
    const g = svg.append('g');

    svg.append('defs').append('marker')
      .attr('id', 'arr')
      .attr('viewBox', '0 -3 6 6').attr('refX', 17).attr('refY', 0)
      .attr('markerWidth', 4).attr('markerHeight', 4).attr('orient', 'auto')
      .append('path').attr('d', 'M0,-3L6,0L0,3').attr('fill', colRule);

    // ── Chapter hull backgrounds ───────────────────────────────────────────────
    const hullG = g.append('g');

    function expandHull(pts, pad) {
      const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      return pts.map(([x, y]) => {
        const dx = x - mx, dy = y - my;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        return [x + dx / d * pad, y + dy / d * pad];
      });
    }

    function updateHulls() {
      const byChapter = new Map();
      for (const n of nodes) {
        const ci = chapterIdx.get(n.id) ?? 0;
        if (!byChapter.has(ci)) byChapter.set(ci, []);
        byChapter.get(ci).push([n.x, n.y]);
      }
      const hullData = [];
      for (const [ci, pts] of byChapter) {
        const raw = pts.length >= 3 ? d3.polygonHull(pts) : null;
        const poly = raw ? expandHull(raw, 18) : null;
        if (poly) hullData.push({ ci, poly });
      }
      const sel = hullG.selectAll('path').data(hullData, d => d.ci);
      sel.enter().append('path').merge(sel)
        .attr('fill', d => chapterColor(d.ci))
        .attr('fill-opacity', 0.07)
        .attr('stroke', d => chapterColor(d.ci))
        .attr('stroke-opacity', 0.25)
        .attr('stroke-width', 1.5)
        .attr('stroke-linejoin', 'round')
        .attr('d', d => 'M' + d.poly.map(p => p.join(',')).join('L') + 'Z');
      sel.exit().remove();
    }

    // ── Edges ─────────────────────────────────────────────────────────────────
    const link = g.append('g').selectAll('line').data(edges).join('line')
      .attr('stroke', d => chapterColor(chapterIdx.get(d._src) ?? 0))
      .attr('stroke-width', 0.9)
      .attr('stroke-opacity', 0.3)
      .attr('marker-end', 'url(#arr)');

    // ── Nodes ─────────────────────────────────────────────────────────────────
    const nodeGroup = g.append('g').selectAll('g').data(nodes).join('g')
      .attr('cursor', 'pointer')
      .on('click', (e, d) => {
        graphOverlay.hidden = true;
        document.getElementById(d.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end',   (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    nodeGroup.append('circle')
      .attr('r', nodeR)
      .attr('fill', d => d.starred ? chapterColor(chapterIdx.get(d.id) ?? 0) : colPaper)
      .attr('stroke', d => chapterColor(chapterIdx.get(d.id) ?? 0))
      .attr('stroke-width', d => d.starred ? 0 : 1.5);

    // Chapter title labels (always visible)
    nodeGroup.filter(d => d.starred).append('text')
      .attr('dy', '0.35em').attr('x', 12)
      .attr('font-size', '9px').attr('font-family', 'Inter, sans-serif')
      .attr('fill', colInk).attr('pointer-events', 'none')
      .text(d => d.title ? `§${d.num} ${d.title}` : `§${d.num}`);

    nodeGroup.append('title')
      .text(d => d.title ? `§${d.num}: ${d.title}` : `§${d.num}`);

    // ── Simulation ────────────────────────────────────────────────────────────
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges).id(d => d.id).distance(45).strength(0.5))
      .force('charge', d3.forceManyBody().strength(d => d.starred ? -200 : -60))
      .force('cluster_x', d3.forceX(d => chapterPos[chapterIdx.get(d.id) ?? 0]?.x ?? cx)
        .strength(d => d.starred ? 0.4 : 0.15))
      .force('cluster_y', d3.forceY(d => chapterPos[chapterIdx.get(d.id) ?? 0]?.y ?? cy)
        .strength(d => d.starred ? 0.4 : 0.15))
      .force('collision', d3.forceCollide(d => nodeR(d) + 4))
      .alphaDecay(0.018)
      .alphaMin(0.001);

    simulation.on('tick', () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      nodeGroup.attr('transform', d => `translate(${d.x},${d.y})`);
      updateHulls();
    });

    // Zoom to fit after simulation settles
    simulation.on('end', () => {
      const bbox = g.node().getBBox();
      if (!bbox.width || !bbox.height) return;
      const pad = 48;
      const scale = Math.min((width - pad * 2) / bbox.width, (height - pad * 2) / bbox.height, 1.8);
      const tx = (width  - bbox.width  * scale) / 2 - bbox.x * scale;
      const ty = (height - bbox.height * scale) / 2 - bbox.y * scale;
      svg.transition().duration(700)
        .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
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

