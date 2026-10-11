// تولید گل به‌صورت SVG، با رنگ و شکل مخصوص هر نفر
(function () {
  const SHAPES = {
    pointed: (w, l) =>
      `M0,0 C${w},${-l * 0.25} ${w * 0.55},${-l * 0.8} 0,${-l} C${-w * 0.55},${-l * 0.8} ${-w},${-l * 0.25} 0,0Z`,
    round: (w, l) =>
      `M0,0 C${w * 1.15},${-l * 0.12} ${w * 1.05},${-l} 0,${-l} C${-w * 1.05},${-l} ${-w * 1.15},${-l * 0.12} 0,0Z`,
  };
  const LENGTHS = [88, 66, 44];
  let uid = 0;

  window.flowerSVG = function (person, opts = {}) {
    const { stem = false, animate = true, delay = 0 } = opts;
    const { petals, shape } = person.flower;
    const t = person.theme;
    const id = "f" + ++uid;
    const grads = [
      [t.petalB, t.petalA],
      [t.petalC, t.petalB],
      [t.petalC, t.petalB],
    ];

    let defs = grads
      .map(
        (g, i) =>
          `<linearGradient id="${id}g${i}" x1="0" y1="1" x2="0" y2="0">
             <stop offset="0" stop-color="${g[0]}"/><stop offset="1" stop-color="${g[1]}"/>
           </linearGradient>`
      )
      .join("");
    defs += `<radialGradient id="${id}c"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="${t.core}"/></radialGradient>`;

    let body = "";
    petals.forEach((n, layer) => {
      const l = LENGTHS[layer];
      const w = l * Math.sin(Math.PI / n) * 1.15;
      const offset = layer % 2 ? 180 / n : 0;
      for (let k = 0; k < n; k++) {
        const angle = offset + (360 / n) * k;
        const d = (delay + layer * 0.28 + k * 0.045).toFixed(2);
        body += `<g transform="rotate(${angle.toFixed(1)})"><path class="petal${animate ? " anim" : ""}" style="--d:${d}s"
          d="${SHAPES[shape](w, l)}" fill="url(#${id}g${layer})"
          stroke="rgba(255,255,255,.55)" stroke-width="1"/></g>`;
      }
    });

    let dots = "";
    for (let k = 0; k < 9; k++) {
      const a = (Math.PI * 2 * k) / 9;
      dots += `<circle cx="${(Math.cos(a) * 7).toFixed(1)}" cy="${(Math.sin(a) * 7).toFixed(1)}" r="1.7" fill="${t.accent}" opacity=".55"/>`;
    }
    const core = `<g class="core${animate ? " anim" : ""}" style="--d:${(delay + 0.9).toFixed(2)}s">
      <circle r="15" fill="url(#${id}c)" stroke="rgba(255,255,255,.7)" stroke-width="1.2"/>${dots}</g>`;

    let stemSvg = "";
    let viewBox = "-100 -100 200 200";
    if (stem) {
      viewBox = "-100 -100 200 380";
      stemSvg = `<g class="stem">
        <path d="M0,0 C8,70 -8,150 0,270" stroke="#3a9a5c" stroke-width="7" fill="none" stroke-linecap="round"/>
        <path d="M0,150 C-30,120 -62,128 -70,108 C-40,100 -10,120 0,150Z" fill="#46ad69"/>
        <path d="M0,195 C30,165 62,172 72,152 C42,144 10,164 0,195Z" fill="#3a9a5c"/>
      </g>`;
    }

    return `<svg class="flower" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>${defs}</defs>${stemSvg}${body}${core}</svg>`;
  };
})();
