// worldcup-static/js/app.js — Interactive World Cup Dashboard
(function() {
'use strict';
const D = window.WORLDCUP_DATA;
const CONT = D.continents;          // ["非洲","亚洲","欧洲","北美洲","大洋洲","南美洲"]
const YEARS = D.years;              // [2002,2006,2010,2014,2018,2022]
const CONT_EN = D.continents_en;    // ["Africa","Asia","Europe","North America","Oceania","South America"]
const CN_TO_EN = Object.fromEntries(CONT.map((c,i) => [c, CONT_EN[i]]));
const EN_TO_CN = Object.fromEntries(CONT_EN.map((c,i) => [c, CONT[i]]));

// ============================================================
// NAVIGATION
// ============================================================
document.querySelectorAll('nav button').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-' + this.dataset.panel).classList.add('active');
    if (this.dataset.panel === 'heatmap') renderHeatmap();
    if (this.dataset.panel === 'stats') initStats();
    if (this.dataset.panel === 'search') initSearch();
  });
});

// ============================================================
// PANEL 1: HEATMAP
// ============================================================
let currentYear = 'all';

function buildYearSelector() {
  const container = document.getElementById('hm-years');
  container.innerHTML = '<span class="label">选择届次：</span>';
  const allBtn = document.createElement('button');
  allBtn.className = 'year-pill' + (currentYear === 'all' ? ' active' : '');
  allBtn.textContent = '全部届次';
  allBtn.addEventListener('click', () => { currentYear = 'all'; buildYearSelector(); renderHeatmap(); });
  container.appendChild(allBtn);
  YEARS.forEach(y => {
    const btn = document.createElement('button');
    btn.className = 'year-pill' + (currentYear === String(y) ? ' active' : '');
    btn.textContent = y;
    btn.addEventListener('click', () => { currentYear = String(y); buildYearSelector(); renderHeatmap(); });
    container.appendChild(btn);
  });
}

function renderHeatmap() {
  const hm = currentYear === 'all' ? D.heatmap_overall : D.heatmap_by_year[currentYear];
  if (!hm) return;

  const z = hm.z;
  const annotations = hm.annotations;
  const x = hm.continents;
  const y = hm.continents.slice().reverse();
  const z_rev = z.slice().reverse();

  // Build custom annotations for Plotly
  const plotlyAnns = [];
  for (let i = 0; i < CONT.length; i++) {
    for (let j = 0; j < CONT.length; j++) {
      const text = annotations[CONT.length - 1 - i][j];
      if (text) {
        plotlyAnns.push({
          x: x[j], y: y[i],
          text: text,
          showarrow: false,
          font: { family: 'Palatino Linotype, Book Antiqua, Palatino, serif', size: 13, color: '#2C3E50' }
        });
      }
    }
  }

  // Colorscale: Economist-style RdYlGn
  const trace = {
    z: z_rev, x: x, y: y,
    type: 'heatmap',
    colorscale: [
      [0, '#C0392B'], [0.25, '#E67E22'], [0.5, '#F1C40F'],
      [0.75, '#7DCEA0'], [1, '#1E8449']
    ],
    zmin: 0, zmax: 1,
    hoverongaps: false,
    hovertemplate: '%{y} vs %{x}<br>胜率: %{z:.1%}<extra></extra>',
    showscale: true,
    colorbar: {
      title: { text: '胜率', font: { family: 'Palatino Linotype, serif', size: 13 } },
      tickformat: '.0%',
      tickfont: { family: 'Palatino Linotype, serif', size: 11 }
    }
  };

  const layout = {
    title: {
      text: currentYear === 'all' ? '各大洲相互胜率热图 | 2002–2022 六届世界杯' : `各大洲相互胜率热图 | ${currentYear} 年世界杯`,
      font: { family: 'Palatino Linotype, Book Antiqua, Palatino, serif', size: 18, color: '#2C3E50' }
    },
    xaxis: { title: { text: '客队所在大洲', font: { size: 14 } }, tickfont: { size: 13 }, side: 'bottom' },
    yaxis: { title: { text: '主队所在大洲', font: { size: 14 } }, tickfont: { size: 13 } },
    annotations: plotlyAnns,
    margin: { l: 100, r: 60, t: 70, b: 80 },
    font: { family: 'Palatino Linotype, Book Antiqua, Palatino, serif' },
    paper_bgcolor: '#FFFFFF',
    plot_bgcolor: '#FFFFFF',
    width: null,
    height: 540
  };

  Plotly.newPlot('heatmap-chart', [trace], layout, { responsive: true, displayModeBar: false });
}

// Initialize heatmap
buildYearSelector();
renderHeatmap();

// ============================================================
// PANEL 2: STATS TABLE
// ============================================================
let statsCont = '欧洲';
let statsYear = 'all';

function initStats() {
  const contSel = document.getElementById('stats-cont');
  const yearSel = document.getElementById('stats-year');
  if (contSel.options.length === 0) {
    CONT.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; contSel.appendChild(o); });
    contSel.value = statsCont;
    contSel.addEventListener('change', () => { statsCont = contSel.value; renderStatsTable(); });
  }
  if (yearSel.options.length === 0) {
    const oa = document.createElement('option'); oa.value = 'all'; oa.textContent = '全部届次'; yearSel.appendChild(oa);
    YEARS.forEach(y => { const o = document.createElement('option'); o.value = String(y); o.textContent = y; yearSel.appendChild(o); });
    yearSel.value = statsYear;
    yearSel.addEventListener('change', () => { statsYear = yearSel.value; renderStatsTable(); renderOverviewTable(); });
  }

  renderStatsTable();
  renderOverviewTable();
}

function makeStageRows(oppCN, detail) {
  const stages = detail.stages || {};
  let stageRows = '';
  const stageOrder = ['小组赛R1', '小组赛R2', '小组赛R3', '淘汰赛'];
  stageOrder.forEach(sn => {
    const sd = stages[sn];
    if (sd) {
      stageRows += `<tr class="stage-row" data-parent="${oppCN}">
        <td style="text-align:left;padding-left:2rem;">↳ ${sn}</td>
        <td>${sd.total}</td>
        <td class="win">${sd.win}</td>
        <td class="draw">${sd.draw}</td>
        <td class="lose">${sd.lose}</td>
        <td class="win">${(sd.win_rate*100).toFixed(1)}%</td>
        <td class="draw">${(sd.draw_rate*100).toFixed(1)}%</td>
        <td class="lose">${(sd.lose_rate*100).toFixed(1)}%</td>
        <td></td>
      </tr>`;
    }
  });
  return stageRows;
}

function renderStatsTable() {
  const tbody = document.querySelector('#stats-table tbody');
  const thead = document.querySelector('#stats-table thead');

  thead.innerHTML = `<tr>
    <th>对阵</th><th>场次</th><th class="win">胜</th><th class="draw">平</th><th class="lose">负</th>
    <th class="win">胜率</th><th class="draw">平率</th><th class="lose">负率</th><th></th>
  </tr>`;

  const contData = D.stats_detail[statsCont];
  if (!contData) { tbody.innerHTML = '<tr><td colspan="9">无数据</td></tr>'; return; }

  let rows = '';
  let totalAll = 0, winAll = 0, drawAll = 0, loseAll = 0;

  // If year-specific, use that data; otherwise use summary
  const dataSource = statsYear === 'all' ? contData.summary : (contData[statsYear] || {});

  for (const oppCN of CONT) {
    const entry = dataSource[oppCN];
    if (!entry) continue;

    const t = entry.total;
    const w = entry.win, d = entry.draw, l = entry.lose;
    const wr = entry.win_rate, dr = entry.draw_rate, lr = entry.lose_rate;
    totalAll += t; winAll += w; drawAll += d; loseAll += l;

    const hasStages = Object.keys(entry.stages || {}).length > 0;

    rows += `<tr class="parent-row">
      <td style="text-align:left;">vs ${oppCN}</td>
      <td>${t}</td>
      <td class="win">${w}</td>
      <td class="draw">${d}</td>
      <td class="lose">${l}</td>
      <td class="win">${(wr*100).toFixed(1)}%</td>
      <td class="draw">${(dr*100).toFixed(1)}%</td>
      <td class="lose">${(lr*100).toFixed(1)}%</td>
      <td>${hasStages ? `<span class="expand-btn" data-opp="${oppCN}">▶</span>` : ''}</td>
    </tr>`;

    // Always render stage rows in HTML, hide by default
    if (hasStages) {
      rows += makeStageRows(oppCN, entry);
    }
  }

  // Summary row
  if (totalAll > 0) {
    const swr = winAll / totalAll, sdr = drawAll / totalAll, slr = loseAll / totalAll;
    rows += `<tr class="summary-row">
      <td>合计</td><td>${totalAll}</td>
      <td class="win">${winAll}</td><td class="draw">${drawAll}</td><td class="lose">${loseAll}</td>
      <td class="win">${(swr*100).toFixed(1)}%</td><td class="draw">${(sdr*100).toFixed(1)}%</td><td class="lose">${(slr*100).toFixed(1)}%</td>
      <td></td>
    </tr>`;
  }

  tbody.innerHTML = rows;

  // Expand/collapse listeners — toggle stage rows for clicked opponent
  tbody.querySelectorAll('.expand-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const opp = this.dataset.opp;
      const tr = this.closest('tr');
      let next = tr.nextElementSibling;
      // Find and toggle all stage rows belonging to this opponent
      let anyVisible = false;
      let cursor = tr.nextElementSibling;
      while (cursor && cursor.classList.contains('stage-row') && cursor.dataset.parent === opp) {
        if (cursor.classList.contains('visible')) anyVisible = true;
        cursor = cursor.nextElementSibling;
      }
      // Toggle: if any visible, hide all; otherwise show all
      cursor = tr.nextElementSibling;
      while (cursor && cursor.classList.contains('stage-row') && cursor.dataset.parent === opp) {
        if (anyVisible) {
          cursor.classList.remove('visible');
        } else {
          cursor.classList.add('visible');
        }
        cursor = cursor.nextElementSibling;
      }
      this.textContent = anyVisible ? '▶' : '▼';
    });
  });
}

function renderOverviewTable() {
  const thead = document.querySelector('#overview-table thead');
  const tbody = document.querySelector('#overview-table tbody');

  // Use year-specific data if a specific year is selected
  const summaryData = statsYear === 'all' ? D.agg_summary : (D.agg_summary_by_year[statsYear] || D.agg_summary);

  // Update card title
  const cardTitle = document.querySelector('#panel-stats .two-col > div:last-child h2');
  if (cardTitle) {
    cardTitle.textContent = statsYear === 'all' ? '大洲胜平负总览（所有届次汇总）' : `大洲胜平负总览（${statsYear}）`;
  }

  thead.innerHTML = `<tr>
    <th>大洲</th><th>总场次</th><th class="win">总胜率</th><th class="draw">平率</th><th class="lose">负率</th>
  </tr>`;

  let rows = '';
  for (const cont of CONT) {
    const d = summaryData[cont];
    if (!d) continue;
    rows += `<tr>
      <td style="text-align:left;font-weight:600;">${cont}</td>
      <td>${d.total}</td>
      <td class="win">${(d.win_rate*100).toFixed(1)}%</td>
      <td class="draw">${(d.draw_rate*100).toFixed(1)}%</td>
      <td class="lose">${(d.lose_rate*100).toFixed(1)}%</td>
    </tr>`;
  }
  tbody.innerHTML = rows;
}

// ============================================================
// PANEL 3: MATCH SEARCH
// ============================================================
let searchReady = false;

function initSearch() {
  if (searchReady) { doSearch(); return; }
  searchReady = true;

  const fYear = document.getElementById('f-year');
  const fCont1 = document.getElementById('f-cont1');
  const fCont2 = document.getElementById('f-cont2');

  // Populate year options
  YEARS.forEach(y => { const o = document.createElement('option'); o.value = String(y); o.textContent = y; fYear.appendChild(o); });
  // Populate continent options
  CONT.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; fCont1.appendChild(o); });
  CONT.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; fCont2.appendChild(o); });

  // Auto-search on any filter change
  fYear.addEventListener('change', doSearch);
  fCont1.addEventListener('change', doSearch);
  fCont2.addEventListener('change', doSearch);

  // Button search + reset
  document.getElementById('btn-search').addEventListener('click', doSearch);
  document.getElementById('btn-reset').addEventListener('click', () => {
    fYear.value = ''; fCont1.value = ''; fCont2.value = '';
    doSearch();
  });

  doSearch();
}

function doSearch() {
  const year = document.getElementById('f-year').value;
  const cont1 = document.getElementById('f-cont1').value;
  const cont2 = document.getElementById('f-cont2').value;

  let filtered = D.matches;

  if (year) {
    filtered = filtered.filter(m => m.year === parseInt(year));
  }
  if (cont1 && cont2) {
    filtered = filtered.filter(m =>
      (m.home_cont === cont1 && m.away_cont === cont2) ||
      (m.home_cont === cont2 && m.away_cont === cont1)
    );
  } else if (cont1) {
    filtered = filtered.filter(m => m.home_cont === cont1 || m.away_cont === cont1);
  } else if (cont2) {
    filtered = filtered.filter(m => m.home_cont === cont2 || m.away_cont === cont2);
  }

  document.getElementById('match-count').textContent = `共 ${filtered.length} 场比赛`;

  const thead = document.querySelector('#match-table thead');
  const tbody = document.querySelector('#match-table tbody');

  thead.innerHTML = `<tr>
    <th>年份</th><th>轮次</th><th>主队</th><th>比分</th><th>客队</th>
    <th>主队大洲</th><th>客队大洲</th><th>胜赔</th><th>平赔</th><th>负赔</th>
    <th>球场</th>
  </tr>`;

  let rows = '';
  filtered.forEach(m => {
    const homeClass = m.home_goals > m.away_goals ? 'result-win' : m.home_goals === m.away_goals ? 'result-draw' : 'result-lose';
    const awayClass = m.away_goals > m.home_goals ? 'result-win' : m.home_goals === m.away_goals ? 'result-draw' : 'result-lose';
    const oddsHome = m.home_odds ? (m.home_odds > 4.0 ? `<span class="odds-highlight">${m.home_odds.toFixed(2)}</span>` : m.home_odds.toFixed(2)) : '-';
    const oddsAway = m.away_odds ? (m.away_odds > 4.0 ? `<span class="odds-highlight">${m.away_odds.toFixed(2)}</span>` : m.away_odds.toFixed(2)) : '-';
    const oddsDraw = m.draw_odds ? m.draw_odds.toFixed(2) : '-';

    rows += `<tr>
      <td>${m.year}</td><td>${m.stage}</td>
      <td class="${homeClass}" style="text-align:left;">${m.home_team}</td>
      <td style="font-weight:700;">${m.home_goals}–${m.away_goals}</td>
      <td class="${awayClass}" style="text-align:left;">${m.away_team}</td>
      <td>${m.home_cont}</td><td>${m.away_cont}</td>
      <td>${oddsHome}</td><td>${oddsDraw}</td><td>${oddsAway}</td>
      <td style="font-size:0.78rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${m.stadium}">${m.stadium || '-'}</td>
    </tr>`;
  });

  tbody.innerHTML = rows || '<tr><td colspan="11" style="padding:2rem;color:var(--text-light);">无匹配结果</td></tr>';
}

// ============================================================
// WINDOW RESIZE — redraw heatmap
// ============================================================
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (document.getElementById('panel-heatmap').classList.contains('active')) {
      renderHeatmap();
    }
  }, 300);
});

})();
