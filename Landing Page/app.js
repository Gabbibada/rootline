// ══════════════════════════════════════════════════════════════════════
// HERO — Rootline brand mark (static)
// The animated canvas tree was replaced by the brand mark; see the
// .hero-mark element in index.html and its styling in style.css.
// ══════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════
// NAV scroll
// ══════════════════════════════════════════════════════════════════════
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 55);
}, { passive: true });

// ══════════════════════════════════════════════════════════════════════
// SCROLL REVEAL
// ══════════════════════════════════════════════════════════════════════
document.querySelectorAll('.reveal').forEach(el => {
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { el.classList.add('visible'); }
  }, { threshold: 0.1 }).observe(el);
});

// ══════════════════════════════════════════════════════════════════════
// NAME CLOUD
// ══════════════════════════════════════════════════════════════════════
[
  ['Grandma Maria',     'Your grandmother'],
  ['Grandpa Carlos',    'Your grandfather'],
  ['Uncle Roberto',     'Your uncle'],
  ['Aunt Ana',          'Your aunt by marriage'],
  ['Cousin Sofia',      'Your first cousin'],
  ['Cousin Miguel',     'Your first cousin'],
  ['Isabel',            '2nd cousin once removed'],
  ['David',             'Your father-in-law'],
  ['Lucia',             'Your sister'],
  ['Great-uncle Tomas', 'Your great-uncle'],
  ['Lena',              'Your first cousin'],
  ['Marcos',            'Your uncle'],
  ['Abuela Rosa',       'Your great-grandmother'],
].forEach(([name, rel]) => {
  const d = document.createElement('div');
  d.className = 'name-tag';
  d.innerHTML = `${name}<span class="tip">${rel}</span>`;
  document.getElementById('name-cloud').appendChild(d);
});

// ══════════════════════════════════════════════════════════════════════
// FAMILY TREE DEMO
// ══════════════════════════════════════════════════════════════════════
// Gen 1 (y=65):  Maria, Carlos
// Gen 2 (y=205): David, Elena, Roberto, Ana
// Gen 3 (y=345): You, Lucia, Miguel, Isabel
const MEMBERS = [
  { id: 'maria',   name: 'Maria\n(Grandma)',  gender: 'F', x: 310, y: 65  },
  { id: 'carlos',  name: 'Carlos\n(Grandpa)', gender: 'M', x: 480, y: 65  },
  { id: 'david',   name: 'David',             gender: 'M', x: 120, y: 205 },
  { id: 'elena',   name: 'Elena',             gender: 'F', x: 268, y: 205 },
  { id: 'roberto', name: 'Roberto',           gender: 'M', x: 590, y: 205 },
  { id: 'ana',     name: 'Ana',               gender: 'F', x: 738, y: 205 },
  { id: 'you',     name: 'You',               gender: 'F', x: 130, y: 345 },
  { id: 'lucia',   name: 'Lucia',             gender: 'F', x: 278, y: 345 },
  { id: 'miguel',  name: 'Miguel',            gender: 'M', x: 580, y: 345 },
  { id: 'isabel',  name: 'Isabel',            gender: 'F', x: 730, y: 345 },
];

// type: 'parent' (from→child) | 'spouse'
const EDGES = [
  { a: 'maria',   b: 'carlos',  type: 'spouse'  },
  { a: 'maria',   b: 'elena',   type: 'parent'  },
  { a: 'carlos',  b: 'elena',   type: 'parent'  },
  { a: 'maria',   b: 'roberto', type: 'parent'  },
  { a: 'carlos',  b: 'roberto', type: 'parent'  },
  { a: 'elena',   b: 'david',   type: 'spouse'  },
  { a: 'elena',   b: 'you',     type: 'parent'  },
  { a: 'david',   b: 'you',     type: 'parent'  },
  { a: 'elena',   b: 'lucia',   type: 'parent'  },
  { a: 'david',   b: 'lucia',   type: 'parent'  },
  { a: 'roberto', b: 'ana',     type: 'spouse'  },
  { a: 'roberto', b: 'miguel',  type: 'parent'  },
  { a: 'ana',     b: 'miguel',  type: 'parent'  },
  { a: 'roberto', b: 'isabel',  type: 'parent'  },
  { a: 'ana',     b: 'isabel',  type: 'parent'  },
];

// Build adjacency list
const adj = {};
MEMBERS.forEach(m => adj[m.id] = []);
EDGES.forEach(({ a, b, type }) => {
  if (type === 'parent') {
    adj[a].push({ id: b, dir: 'down' });
    adj[b].push({ id: a, dir: 'up'   });
  } else {
    adj[a].push({ id: b, dir: 'spouse' });
    adj[b].push({ id: a, dir: 'spouse' });
  }
});

// BFS — returns { path: [id,...], dirs: [dir,...] } or null
function bfs(start, end) {
  if (start === end) return null;
  const visited = new Set([start]);
  const q = [{ id: start, path: [start], dirs: [] }];
  while (q.length) {
    const { id, path, dirs } = q.shift();
    for (const { id: nid, dir } of adj[id]) {
      if (visited.has(nid)) continue;
      visited.add(nid);
      const np = [...path, nid], nd = [...dirs, dir];
      if (nid === end) return { path: np, dirs: nd };
      q.push({ id: nid, path: np, dirs: nd });
    }
  }
  return null;
}

// Label from direction sequence
function label(dirs, gender) {
  const seq = dirs.join(',');
  const m = gender === 'M';
  const map = {
    'spouse':                      m ? 'Your husband'              : 'Your wife',
    'up':                          m ? 'Your father'               : 'Your mother',
    'down':                        m ? 'Your son'                  : 'Your daughter',
    'up,spouse':                   m ? 'Your father-in-law'        : 'Your mother-in-law',
    'spouse,up':                   m ? 'Your father-in-law'        : 'Your mother-in-law',
    'up,up':                       m ? 'Your grandfather'          : 'Your grandmother',
    'down,down':                   m ? 'Your grandson'             : 'Your granddaughter',
    'up,down':                     m ? 'Your brother'              : 'Your sister',
    'down,up':                     m ? 'Your brother'              : 'Your sister',
    'up,down,spouse':              m ? 'Your brother-in-law'       : 'Your sister-in-law',
    'up,spouse,down':              m ? 'Your brother-in-law'       : 'Your sister-in-law',
    'up,up,down':                  m ? 'Your uncle'                : 'Your aunt',
    'up,up,down,spouse':           m ? 'Your uncle-in-law'         : 'Your aunt-in-law',
    'up,up,spouse':                m ? 'Your grandpa\'s brother'   : 'Your grandma\'s sister',
    'up,up,down,down':             'Your first cousin',
    'up,up,up':                    m ? 'Your great-grandfather'    : 'Your great-grandmother',
    'up,up,up,down':               m ? 'Your great-uncle'          : 'Your great-aunt',
    'up,up,up,down,down':          'Your first cousin once removed',
    'up,up,up,down,down,down':     'Your second cousin',
    'up,up,down,down,down':        'Your first cousin once removed',
    'up,down,down':                m ? 'Your nephew'               : 'Your niece',
    'down,up,down':                m ? 'Your nephew'               : 'Your niece',
    'down,down,up':                m ? 'Your grandson\'s uncle'    : 'Your granddaughter\'s aunt',
  };
  if (map[seq]) return map[seq];
  const ups     = dirs.filter(d => d === 'up').length;
  const downs   = dirs.filter(d => d === 'down').length;
  const spouses = dirs.filter(d => d === 'spouse').length;
  if (ups === 0 && downs === 0) return 'Your spouse';
  if (ups > 0 && downs === 0 && spouses === 0) return 'Your ancestor';
  if (downs > 0 && ups === 0 && spouses === 0) return 'Your descendant';
  return 'Your family member';
}

// SVG rendering
const NS       = 'http://www.w3.org/2000/svg';
const svg      = document.getElementById('family-svg');
const resultEl = document.getElementById('demo-result');
const hintEl   = document.getElementById('demo-hint');

function render(litPath = [], litEdges = new Set(), selA = null, selB = null) {
  svg.innerHTML = '';

  // Edges drawn behind nodes
  EDGES.forEach(({ a, b, type }) => {
    const A = MEMBERS.find(m => m.id === a);
    const B = MEMBERS.find(m => m.id === b);
    const lit = litEdges.has(`${a}-${b}`) || litEdges.has(`${b}-${a}`);
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', A.x); line.setAttribute('y1', A.y);
    line.setAttribute('x2', B.x); line.setAttribute('y2', B.y);
    line.setAttribute('class', `t-link${type === 'spouse' ? ' spouse' : ''}${lit ? ' lit' : ''}`);
    svg.appendChild(line);
  });

  // Nodes
  MEMBERS.forEach(m => {
    const isSelA = m.id === selA;
    const isSelB = m.id === selB;
    const isPath = litPath.includes(m.id) && !isSelA && !isSelB;
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', `t-node${isSelA || isSelB ? ' sel' : isPath ? ' path' : ''}`);
    g.setAttribute('transform', `translate(${m.x},${m.y})`);
    g.dataset.id = m.id;

    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('r', 30);
    g.appendChild(c);

    m.name.split('\n').forEach((line, i, arr) => {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('y', arr.length > 1 ? (i === 0 ? -7.5 : 9) : 0);
      t.textContent = line;
      g.appendChild(t);
    });

    g.addEventListener('click', () => handleClick(m.id));
    svg.appendChild(g);
  });
}

let selA = null;

function handleClick(id) {
  if (!selA) {
    selA = id;
    render([], new Set(), selA, null);
    const name = MEMBERS.find(m => m.id === id).name.replace('\n', ' ');
    hintEl.textContent = `Now click another person to see their relationship to ${name}`;
    resultEl.innerHTML = `<p class="result-idle">Now pick a second person…</p>`;
    return;
  }
  if (selA === id) {
    selA = null;
    render();
    hintEl.textContent = 'Start by clicking any person in the tree';
    resultEl.innerHTML = `<p class="result-idle">Select two people above to see their relationship</p>`;
    return;
  }

  const res = bfs(selA, id);
  if (!res) {
    resultEl.innerHTML = `<p class="result-label">Not directly connected</p>`;
    selA = null; render(); return;
  }

  const { path, dirs } = res;
  const litEdges = new Set();
  for (let i = 0; i < path.length - 1; i++) {
    litEdges.add(`${path[i]}-${path[i+1]}`);
    litEdges.add(`${path[i+1]}-${path[i]}`);
  }

  const target    = MEMBERS.find(m => m.id === id);
  const rel       = label(dirs, target.gender);
  const pathNames = path.map(pid => MEMBERS.find(m => m.id === pid).name.replace('\n', ' ')).join(' → ');

  render(path, litEdges, selA, id);
  hintEl.textContent = 'Click any node to start over';
  resultEl.innerHTML = `
    <div class="result-label">${rel}</div>
    <div class="result-path">${pathNames}</div>
    <button class="result-reset" id="reset-btn">Reset</button>
  `;

  document.getElementById('reset-btn').addEventListener('click', () => {
    selA = null; render();
    hintEl.textContent = 'Start by clicking any person in the tree';
    resultEl.innerHTML = `<p class="result-idle">Select two people above to see their relationship</p>`;
  });

  selA = null;
}

render();

// ══════════════════════════════════════════════════════════════════════
// WAITLIST FORM
// ══════════════════════════════════════════════════════════════════════
document.getElementById('waitlist-form').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const btn  = form.querySelector('button');
  btn.textContent = 'Submitting…';
  btn.disabled = true;

  try {
    const res = await fetch('https://formspree.io/f/mnjrwnqg', {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: new FormData(form),
    });
    if (res.ok) {
      form.style.display = 'none';
      document.getElementById('waitlist-thanks').style.display = 'block';
    } else {
      btn.textContent = 'Try again';
      btn.disabled = false;
    }
  } catch {
    btn.textContent = 'Try again';
    btn.disabled = false;
  }
});
