(function () {
  const $ = (s) => document.querySelector(s);
  const key = new URLSearchParams(location.search).get("k");
  const me = window.PEOPLE.find((p) => p.slug === key);

  const stages = ["landing", "gift", "bloom", "garden"];
  function show(id) {
    stages.forEach((s) => $("#" + s).classList.toggle("active", s === id));
    window.scrollTo({ top: 0 });
  }

  if (!me) {
    show("landing");
    return;
  }

  // ---------- تم ----------
  const t = me.theme;
  const root = document.documentElement.style;
  root.setProperty("--bg1", t.bg1);
  root.setProperty("--bg2", t.bg2);
  root.setProperty("--ink", t.ink);
  root.setProperty("--soft", t.soft);
  root.setProperty("--accent", t.accent);
  root.setProperty("--pa", t.petalA);
  root.setProperty("--pb", t.petalB);
  root.setProperty("--pc", t.petalC);
  document.querySelector('meta[name="theme-color"]').content = t.bg1;
  document.title = `${me.name} جان، یه چیزی برات دارم 🎁`;
  $("#toName").textContent = me.name;

  // ---------- گلبرگ‌های در حال ریزش ----------
  const colors = [t.petalA, t.petalB, t.petalC];
  for (let i = 0; i < 16; i++) {
    const el = document.createElement("i");
    el.className = "fp";
    const size = 10 + Math.random() * 14;
    el.style.cssText = `left:${Math.random() * 100}%;width:${size}px;height:${size}px;background:${colors[i % 3]};` +
      `animation-duration:${9 + Math.random() * 9}s;animation-delay:${-Math.random() * 18}s`;
    $("#petals").appendChild(el);
  }

  // ---------- صدا ----------
  let muted = false;
  let ctx;
  function chime() {
    if (muted) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
      notes.forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const at = ctx.currentTime + i * 0.13;
        o.type = "sine";
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.16, at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
        o.connect(g).connect(ctx.destination);
        o.start(at);
        o.stop(at + 1.5);
      });
    } catch (e) { /* صدا اختیاریه */ }
  }
  $("#mute").hidden = false;
  $("#mute").addEventListener("click", () => {
    muted = !muted;
    $("#mute").textContent = muted ? "🔇" : "🔊";
  });

  // ---------- کانفتی ----------
  function confetti() {
    const c = $("#fx");
    const g = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    g.scale(dpr, dpr);
    const palette = [t.petalA, t.petalB, t.petalC, t.core, t.accent, "#ffffff"];
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const n = reduce ? 40 : 170;
    const ox = innerWidth / 2, oy = innerHeight * 0.52;
    const ps = Array.from({ length: n }, () => {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const v = 6 + Math.random() * 10;
      return {
        x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        w: 6 + Math.random() * 7, h: 4 + Math.random() * 6, r: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.4, col: palette[(Math.random() * palette.length) | 0],
        round: Math.random() < 0.3,
      };
    });
    let frames = 0;
    (function tick() {
      g.clearRect(0, 0, innerWidth, innerHeight);
      let alive = false;
      ps.forEach((p) => {
        p.vy += 0.22; p.vx *= 0.992; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        if (p.y < innerHeight + 20) alive = true;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.r);
        g.fillStyle = p.col;
        if (p.round) { g.beginPath(); g.arc(0, 0, p.w / 2, 0, 7); g.fill(); }
        else g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        g.restore();
      });
      if (alive && ++frames < 400) requestAnimationFrame(tick);
      else g.clearRect(0, 0, innerWidth, innerHeight);
    })();
  }

  // ---------- پیام ----------
  const card = $("#card");
  let step = 0;
  const paras = me.paragraphs.map((p, i) => `<p style="--t:${(0.15 + i * 0.7).toFixed(2)}s">${p}</p>`).join("");
  const after = 0.15 + me.paragraphs.length * 0.7;
  card.innerHTML = `
    <h3>${me.greeting}</h3>${paras}
    <p class="closing" style="--t:${after.toFixed(2)}s">${me.closing}</p>
    <p class="sign" style="--t:${(after + 0.5).toFixed(2)}s">${me.sign}</p>
    <div style="text-align:center"><button class="btn" id="toGarden" style="--t:${(after + 1).toFixed(2)}s">باغ ما رو ببین 🌷</button></div>`;

  // ---------- مراحل ----------
  const box = $("#box");
  let opened = false;
  box.addEventListener("click", () => {
    if (opened) return;
    opened = true;
    box.classList.add("open");
    chime();
    setTimeout(confetti, 350);
    $(".hint").style.visibility = "hidden";
    setTimeout(() => box.classList.add("gone"), 1500);
    setTimeout(startBloom, 2000);
  });

  function startBloom() {
    $("#bigFlower").innerHTML = window.flowerSVG(me, { delay: 0.1 });
    show("bloom");
    setTimeout(() => $("#bloom").classList.add("revealed"), 2600);
    setTimeout(() => card.classList.add("ready"), 3300);
    setTimeout(() => card.classList.add("show"), 3450);
  }

  function buildGarden() {
    const field = $("#field");
    field.innerHTML = "";
    window.PEOPLE.forEach((p, i) => {
      const d = document.createElement("div");
      d.className = "gf" + (p.slug === me.slug ? " me" : "");
      d.innerHTML = window.flowerSVG(p, { stem: true, delay: 0.2 + i * 0.25 }) +
        `<span class="gname">${p.name}${p.slug === me.slug ? " ✨" : ""}</span>`;
      d.addEventListener("click", () => {
        toast(p.slug === me.slug ? "این گل توئه 💐" : `این گلِ ${p.name} جانه، پیامش مخصوص خودشه 🤫`);
      });
      field.appendChild(d);
    });
  }

  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("on"), 2400);
  }

  document.addEventListener("click", (e) => {
    if (e.target.id === "toGarden") {
      buildGarden();
      show("garden");
      confetti();
    }
  });
  $("#backToCard").addEventListener("click", () => show("bloom"));

  show("gift");
})();
