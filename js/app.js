// Interfaz: lee N y alfa de la barra, recalcula los filtros y redibuja todo.
(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const fechas = DATOS.map((d) => d[0]);
  const x = DATOS.map((d) => d[1]);
  const estado = { N: 5, alfa: 1 / 3, trabado: true };

  // ------------------------------------------------------------ utilidades
  const $ = (id) => document.getElementById(id);
  const num = (v, dec = 2) =>
    v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: false });
  const pesos = (v, dec = 2) => "$" + num(v, dec);
  const dias = (v, dec = 1) => {
    const entero = Math.abs(v - Math.round(v)) < 1e-9;
    const t = num(v, entero ? 0 : dec);
    return t + (t === "1" ? " día" : " días");
  };
  const fechaCorta = (f) => f.slice(8) + "/" + f.slice(5, 7);

  function el(padre, tag, attrs = {}, texto) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (texto !== undefined) e.textContent = texto;
    padre.appendChild(e);
    return e;
  }

  function lienzo(svg, W, H, m) {
    svg.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    return { W, H, m, x0: m.l, x1: W - m.r, y0: H - m.b, y1: m.t };
  }
  const escala = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

  function ejes(svg, c, sx, sy, ticksX, ticksY, rotX, rotY) {
    const g = el(svg, "g", { class: "grilla" });
    const e = el(svg, "g", { class: "eje" });
    ticksY.forEach((t) => {
      const y = sy(t.v);
      el(g, "line", { x1: c.x0, x2: c.x1, y1: y, y2: y });
      el(e, "text", { x: c.x0 - 9, y: y + 5, "text-anchor": "end" }, t.t);
    });
    ticksX.forEach((t) => {
      const px = sx(t.v);
      el(e, "line", { x1: px, x2: px, y1: c.y0, y2: c.y0 + 6 });
      el(e, "text", { x: px, y: c.y0 + 24, "text-anchor": "middle" }, t.t);
    });
    el(e, "path", { d: `M${c.x0},${c.y1}V${c.y0}H${c.x1}` });
    if (rotX) el(svg, "text", { class: "rotulo", x: (c.x0 + c.x1) / 2, y: c.H - 6, "text-anchor": "middle" }, rotX);
    if (rotY) el(svg, "text", { class: "rotulo", x: c.x0 - c.m.l + 4, y: c.y1 - 12 }, rotY);
  }

  function trazo(pts) {
    let d = "", abierto = false;
    pts.forEach(([px, py]) => {
      if (py === null || Number.isNaN(py)) { abierto = false; return; }
      d += (abierto ? "L" : "M") + px.toFixed(1) + "," + py.toFixed(1);
      abierto = true;
    });
    return d;
  }

  // ------------------------------------------------- gráfico de la serie real
  let serie = null;
  function dibujarSerie(mm, ex) {
    const svg = $("grafSerie");
    const c = lienzo(svg, 1000, 430, { l: 66, r: 16, t: 34, b: 50 });
    const lo = Math.floor((Math.min(...x) - 5) / 10) * 10, hi = Math.ceil((Math.max(...x) + 5) / 10) * 10;
    const sx = escala(0, x.length - 1, c.x0 + 8, c.x1 - 8), sy = escala(lo, hi, c.y0, c.y1);
    const tx = [], ty = [];
    for (let i = 0; i < x.length; i += 10) tx.push({ v: i, t: fechaCorta(fechas[i]) });
    for (let v = lo; v <= hi; v += 10) ty.push({ v, t: "$" + v });
    ejes(svg, c, sx, sy, tx, ty, "Fecha (días hábiles de 2026)", "Pesos por dólar");
    el(svg, "path", { class: "t-dato", d: trazo(x.map((v, i) => [sx(i), sy(v)])) });
    x.forEach((v, i) => el(svg, "circle", { class: "p-dato", cx: sx(i), cy: sy(v), r: 2.6 }));
    el(svg, "path", { class: "t-mm", d: trazo(mm.map((v, i) => [sx(i), v === null ? null : sy(v)])) });
    el(svg, "path", { class: "t-exp", d: trazo(ex.map((v, i) => [sx(i), sy(v)])) });
    const guia = el(svg, "g", { visibility: "hidden" });
    const linea = el(guia, "line", { class: "guia", y1: c.y1, y2: c.y0 });
    const pd = el(guia, "circle", { class: "p-dato", r: 5 });
    const pm = el(guia, "circle", { class: "p-mm", r: 6 });
    const pe = el(guia, "circle", { class: "p-exp", r: 6 });
    serie = { svg, c, sx, sy, mm, ex, guia, linea, pd, pm, pe };
  }

  let ultimoIndice = null;
  function marcar(i) {
    const s = serie, globo = $("globo");
    if (i === null) { s.guia.setAttribute("visibility", "hidden"); globo.hidden = true; ultimoIndice = null; return; }
    ultimoIndice = i;
    const px = s.sx(i);
    s.guia.setAttribute("visibility", "visible");
    s.linea.setAttribute("x1", px); s.linea.setAttribute("x2", px);
    s.pd.setAttribute("cx", px); s.pd.setAttribute("cy", s.sy(x[i]));
    s.pe.setAttribute("cx", px); s.pe.setAttribute("cy", s.sy(s.ex[i]));
    if (s.mm[i] === null) s.pm.setAttribute("visibility", "hidden");
    else { s.pm.setAttribute("visibility", "inherit"); s.pm.setAttribute("cx", px); s.pm.setAttribute("cy", s.sy(s.mm[i])); }
    const f = fechas[i];
    globo.innerHTML =
      `<b>${f.slice(8)}/${f.slice(5, 7)}/${f.slice(0, 4)}</b>` +
      `<div class="f"><span>Dólar blue</span><b>${pesos(x[i], 0)}</b></div>` +
      `<div class="f g-mm"><span>Media móvil</span><b>${s.mm[i] === null ? "sin datos aún" : pesos(s.mm[i])}</b></div>` +
      `<div class="f g-exp"><span>Exponencial</span><b>${pesos(s.ex[i])}</b></div>`;
    globo.hidden = false;
    const caja = s.svg.getBoundingClientRect();
    const frac = px / s.c.W;
    const ancho = globo.offsetWidth;
    let izq = frac * caja.width + 14;
    if (izq + ancho > caja.width) izq = frac * caja.width - ancho - 14;
    globo.style.left = Math.max(0, izq) + "px";
  }

  function prepararCursor() {
    const svg = $("grafSerie");
    const indice = (ev) => {
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * serie.c.W;
      const i = Math.round(((px - serie.c.x0 - 8) / (serie.c.x1 - serie.c.x0 - 16)) * (x.length - 1));
      return Math.max(0, Math.min(x.length - 1, i));
    };
    svg.addEventListener("pointermove", (ev) => marcar(indice(ev)));
    svg.addEventListener("pointerdown", (ev) => marcar(indice(ev)));
    svg.addEventListener("pointerleave", () => marcar(null));
  }

  // ------------------------------------------------------ tabla comparativa
  function tablaComparativa(mm, ex) {
    const { N, alfa } = estado;
    const desde = Math.max(10, N - 1);
    const rug = (v) => {
      const d = [];
      for (let n = desde + 1; n < v.length; n++) d.push(v[n] - v[n - 1]);
      const m = d.reduce((s, t) => s + t, 0) / d.length;
      return Math.sqrt(d.reduce((s, t) => s + (t - m) ** 2, 0) / d.length);
    };
    const medMM = Filtros.retrasoMedido(mm, x), medExp = Filtros.retrasoMedido(ex, x);
    const pct = (v) => num(100 * Math.sqrt(v), 0) + " %";
    $("cRetMM").innerHTML = dias(Filtros.retardoMM(N));
    $("cRetExp").innerHTML = dias((1 - alfa) / alfa);
    $("cMedMM").innerHTML = dias(medMM.k);
    $("cMedExp").innerHTML = dias(medExp.k);
    $("cRuiMM").innerHTML = pct(Filtros.ruidoMM(N)) + "<small>del desvío original</small>";
    $("cRuiExp").innerHTML = pct(Filtros.ruidoExp(alfa)) + "<small>del desvío original</small>";
    $("cVarDato").textContent = "El dato sin filtrar varía " + pesos(rug(x)) + " por día";
    $("cVarMM").textContent = pesos(rug(mm));
    $("cVarExp").textContent = pesos(rug(ex));
    $("cMemMM").textContent = N;
    $("cMemExp").textContent = "1";
    return { medMM, medExp };
  }

  // -------------------------------------------------------- polos y ceros
  function plano(svg, color) {
    const c = lienzo(svg, 260, 260, { l: 0, r: 0, t: 0, b: 0 });
    const R = 92, cx = 130, cy = 130;
    const e = el(svg, "g", { class: "eje" });
    el(e, "line", { x1: 12, x2: 248, y1: cy, y2: cy });
    el(e, "line", { x1: cx, x2: cx, y1: 12, y2: 248 });
    el(e, "text", { x: 250, y: cy - 8, "text-anchor": "end" }, "Re");
    el(e, "text", { x: cx + 8, y: 22 }, "Im");
    el(e, "text", { x: cx + R + 5, y: cy + 20 }, "1");
    el(svg, "circle", { class: "circulo", cx, cy, r: R });
    return {
      cero: (re, im) => el(svg, "circle", { class: "cero", cx: cx + re * R, cy: cy - im * R, r: 6.5, stroke: color }),
      polo: (re, im) => {
        const px = cx + re * R, py = cy - im * R, d = 7;
        el(svg, "path", { class: "polo", stroke: color, d: `M${px - d},${py - d}L${px + d},${py + d}M${px - d},${py + d}L${px + d},${py - d}` });
      },
    };
  }

  function dibujarPlanos() {
    const { N, alfa } = estado;
    const css = getComputedStyle(document.documentElement);
    const a = plano($("pzMM"), css.getPropertyValue("--mm").trim());
    for (let k = 1; k < N; k++) a.cero(Math.cos((2 * Math.PI * k) / N), Math.sin((2 * Math.PI * k) / N));
    a.polo(0, 0);
    $("pzMMtxt").innerHTML =
      `<strong>Media móvil.</strong> ${N - 1} ${N === 2 ? "cero (círculo)" : "ceros (círculos)"} sobre el círculo unitario y ` +
      `${N - 1} ${N === 2 ? "polo" : "polos"} en el origen (cruz). Siempre es estable.`;
    const b = plano($("pzExp"), css.getPropertyValue("--exp").trim());
    b.cero(0, 0);
    b.polo(1 - alfa, 0);
    $("pzExptxt").innerHTML =
      `<strong>Suavizado exponencial.</strong> Un cero en el origen y un polo en z = 1 − α = ${num(1 - alfa, 3)}. ` +
      `Está dentro del círculo, así que es estable. Cuanto más cerca de 1, más suaviza y más atrasa.`;
  }

  // -------------------------------------------- respuesta en frecuencia
  const PERIODOS = [40, 10, 5, 3, 2];
  function dibujarFrecuencia() {
    const { N, alfa } = estado;
    const ticksX = PERIODOS.map((T) => ({ v: 1 / T, t: T + (T === 40 ? " días" : "") }));
    const ws = [];
    for (let i = 0; i <= 400; i++) ws.push(1e-4 + (Math.PI - 1e-4) * (i / 400));

    let svg = $("grafGan");
    let c = lienzo(svg, 520, 340, { l: 52, r: 14, t: 34, b: 54 });
    let sx = escala(0, 0.5, c.x0, c.x1), sy = escala(0, 1, c.y0, c.y1);
    ejes(svg, c, sx, sy, ticksX, [0, 0.25, 0.5, 0.75, 1].map((v) => ({ v, t: num(v, 2) })),
      "Período de la oscilación", "Ganancia");
    el(svg, "path", { class: "t-mm", d: trazo(ws.map((w) => [sx(w / (2 * Math.PI)), sy(Filtros.gananciaMM(w, N))])) });
    el(svg, "path", { class: "t-exp", d: trazo(ws.map((w) => [sx(w / (2 * Math.PI)), sy(Filtros.gananciaExp(w, alfa))])) });

    svg = $("grafRet");
    c = lienzo(svg, 520, 340, { l: 52, r: 14, t: 34, b: 54 });
    const tMM = Filtros.retardoMM(N), tE0 = (1 - alfa) / alfa;
    const techo = Math.max(2, Math.ceil(Math.max(tMM, tE0) + 0.01));
    const paso = techo <= 4 ? 1 : techo <= 10 ? 2 : 5;
    sx = escala(0, 0.5, c.x0, c.x1); sy = escala(-1, techo, c.y0, c.y1);
    const ty = [];
    for (let v = 0; v <= techo; v += paso) ty.push({ v, t: String(v) });
    ejes(svg, c, sx, sy, ticksX, ty, "Período de la oscilación", "Días de retraso");
    el(svg, "path", { class: "t-mm", d: `M${c.x0},${sy(tMM)}H${c.x1}` });
    el(svg, "path", { class: "t-exp", d: trazo(ws.map((w) => [sx(w / (2 * Math.PI)), sy(Filtros.retardoExp(w, alfa))])) });
  }

  // ------------------------------------------------------------- el salto
  let diaSalto = 12, reloj = null;
  function dibujarSalto() {
    const { N, alfa } = estado;
    const svg = $("grafSalto");
    const c = lienzo(svg, 760, 380, { l: 66, r: 16, t: 34, b: 54 });
    const sx = escala(-2, 12, c.x0 + 10, c.x1 - 10), sy = escala(1490, 1610, c.y0, c.y1);
    const tx = [];
    for (let d = -2; d <= 12; d += 2) tx.push({ v: d, t: String(d) });
    ejes(svg, c, sx, sy, tx, [1500, 1525, 1550, 1575, 1600].map((v) => ({ v, t: "$" + v })),
      "Días desde el salto", "Pesos por dólar");
    el(svg, "path", { class: "t-esc", d: `M${sx(-2)},${sy(1500)}H${sx(-0.5)}V${sy(1600)}H${sx(12)}` });
    const valor = (f) => (d) => (d < 0 ? 1500 : 1500 + 100 * f(d));
    const vm = valor((d) => Filtros.escalonMM(d, N)), ve = valor((d) => Filtros.escalonExp(d, alfa));
    const dd = [];
    for (let d = -2; d <= diaSalto; d++) dd.push(d);
    el(svg, "path", { class: "t-mm", d: trazo(dd.map((d) => [sx(d), sy(vm(d))])) });
    el(svg, "path", { class: "t-exp", d: trazo(dd.map((d) => [sx(d), sy(ve(d))])) });
    dd.forEach((d) => {
      el(svg, "circle", { class: "p-mm", cx: sx(d), cy: sy(vm(d)), r: 5 });
      el(svg, "circle", { class: "p-exp", cx: sx(d), cy: sy(ve(d)), r: 5 });
    });
    const d = diaSalto;
    $("saltoTxt").innerHTML = d < 0
      ? "Antes del salto los dos filtros marcan $1500."
      : `${d === 0 ? "El día del salto" : d === 1 ? "Un día después" : d + " días después"}: ` +
        `la <b class="mm">media móvil</b> muestra ${pesos(100 * Filtros.escalonMM(d, N), 0)} de los $100 y ` +
        `el <b class="exp">exponencial</b>, ${pesos(100 * Filtros.escalonExp(d, alfa), 0)}.` +
        (d === 12 ? ` La media móvil llega al 100 % en ${N} días; el exponencial se acerca cada vez más pero nunca llega del todo.` : "");
  }

  function reproducirSalto() {
    clearInterval(reloj);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { diaSalto = 12; dibujarSalto(); return; }
    diaSalto = -2;
    dibujarSalto();
    reloj = setInterval(() => {
      diaSalto += 1;
      dibujarSalto();
      if (diaSalto >= 12) clearInterval(reloj);
    }, 650);
  }

  // ------------------------------------------- tabla manual (N = 5, α = 1/3)
  function tablaManual() {
    const cuerpo = $("tablaManual").querySelector("tbody");
    const r2 = (v) => Math.round(v * 100 + 1e-7) / 100;
    let yE = x[0], yM = null;
    for (let n = 0; n < 8; n++) {
      let tm = "todavía no hay cinco datos", te;
      if (n === 4) {
        const s = x.slice(0, 5).reduce((a, b) => a + b, 0);
        yM = s / 5;
        tm = `${s} / 5 = <b>${num(yM)}</b>`;
      } else if (n > 4) {
        const ant = yM;
        yM = ant + (x[n] - x[n - 5]) / 5;
        tm = `${num(ant, 0)} + (${x[n]} − ${x[n - 5]}) / 5 = <b>${num(yM)}</b>`;
      }
      if (n === 0) te = `<b>${num(yE)}</b> (valor inicial)`;
      else {
        const ant = yE;
        yE = r2((x[n] + 2 * ant) / 3);
        te = `(${x[n]} + 2 · ${num(ant)}) / 3 = <b>${num(yE)}</b>`;
      }
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${n}</td><td>${fechaCorta(fechas[n])}</td><td>$${x[n]}</td><td>${tm}</td><td>${te}</td>`;
      cuerpo.appendChild(tr);
    }
  }

  // ------------------------------------------------------------ ciclo general
  function actualizar() {
    const { N, alfa } = estado;
    $("outN").textContent = N;
    $("outA").textContent = num(alfa, 3);
    $("inA").value = alfa;
    $("inA").disabled = estado.trabado;
    const mm = Filtros.mediaMovil(x, N), ex = Filtros.exponencial(x, alfa);
    const fijo = ultimoIndice;
    dibujarSerie(mm, ex);
    if (fijo !== null) marcar(fijo);
    const { medExp } = tablaComparativa(mm, ex);
    dibujarPlanos();
    dibujarFrecuencia();
    dibujarSalto();
    const tE = (T) => Filtros.retardoExp((2 * Math.PI) / T, alfa);
    $("fraseRetraso").textContent =
      `Con α = ${num(alfa, 3)}, el exponencial atrasa ${dias((1 - alfa) / alfa)} una tendencia lenta, ` +
      `${dias(Math.max(0, tE(20)))} una oscilación de 20 días y ${dias(Math.max(0, tE(10)))} una de 10. ` +
      `La media móvil de ${N} días atrasa ${dias(Filtros.retardoMM(N))} en todos los casos. ` +
      `Medido sobre los datos reales, el exponencial llega ${dias(medExp.k)} tarde.`;
  }

  $("inN").addEventListener("input", (e) => {
    estado.N = Number(e.target.value);
    if (estado.trabado) estado.alfa = 2 / (estado.N + 1);
    actualizar();
  });
  $("inA").addEventListener("input", (e) => { estado.alfa = Number(e.target.value); actualizar(); });
  $("inTraba").addEventListener("change", (e) => {
    estado.trabado = e.target.checked;
    if (estado.trabado) estado.alfa = 2 / (estado.N + 1);
    actualizar();
  });
  $("btnSalto").addEventListener("click", reproducirSalto);

  tablaManual();
  actualizar();
  prepararCursor();
})();
