// Matemática de los dos filtros. Todo sale de las ecuaciones en diferencias
// y de las funciones de transferencia H(z) deducidas en el informe.

const Filtros = {
  // Media móvil: y[n] = (1/N) * suma de las últimas N muestras (definida desde n = N-1)
  mediaMovil(x, N) {
    const y = new Array(x.length).fill(null);
    for (let n = N - 1; n < x.length; n++) {
      let s = 0;
      for (let k = 0; k < N; k++) s += x[n - k];
      y[n] = s / N;
    }
    return y;
  },

  // Suavizado exponencial: y[n] = alfa*x[n] + (1-alfa)*y[n-1], con y[0] = x[0]
  exponencial(x, alfa) {
    const y = [x[0]];
    for (let n = 1; n < x.length; n++) y.push(alfa * x[n] + (1 - alfa) * y[n - 1]);
    return y;
  },

  // |H(e^jw)| de la media móvil: |sen(wN/2) / (N sen(w/2))|
  gananciaMM(w, N) {
    if (w < 1e-9) return 1;
    return Math.abs(Math.sin((w * N) / 2) / (N * Math.sin(w / 2)));
  },

  // |H(e^jw)| del exponencial: alfa / sqrt(1 - 2b cos w + b^2), con b = 1 - alfa
  gananciaExp(w, alfa) {
    const b = 1 - alfa;
    return alfa / Math.sqrt(1 - 2 * b * Math.cos(w) + b * b);
  },

  // Retardo de grupo en días
  retardoMM(N) { return (N - 1) / 2; },
  retardoExp(w, alfa) {
    const b = 1 - alfa;
    return (b * (Math.cos(w) - b)) / (1 - 2 * b * Math.cos(w) + b * b);
  },

  // Fracción de la varianza de un ruido blanco que deja pasar cada filtro
  ruidoMM(N) { return 1 / N; },
  ruidoExp(alfa) { return alfa / (2 - alfa); },

  // Respuesta al escalón: fracción del salto reflejada n días después
  escalonMM(n, N) { return Math.min(n + 1, N) / N; },
  escalonExp(n, alfa) { return 1 - Math.pow(1 - alfa, n + 1); },

  // Retraso medido sobre los datos: desplazamiento k que maximiza la
  // correlación entre la salida y[n] y la entrada atrasada x[n-k]
  retrasoMedido(y, x, maxK = 10) {
    const desde = Math.max(10, y.findIndex((v) => v !== null));
    let mejor = { k: 0, r: -2 };
    for (let k = 0; k <= maxK; k++) {
      const a = [], b = [];
      for (let n = desde; n < x.length; n++) { a.push(y[n]); b.push(x[n - k]); }
      const r = Filtros.correlacion(a, b);
      if (r > mejor.r) mejor = { k, r };
    }
    return mejor;
  },

  correlacion(a, b) {
    const n = a.length;
    const ma = a.reduce((s, v) => s + v, 0) / n;
    const mb = b.reduce((s, v) => s + v, 0) / n;
    let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < n; i++) {
      sab += (a[i] - ma) * (b[i] - mb);
      saa += (a[i] - ma) ** 2;
      sbb += (b[i] - mb) ** 2;
    }
    return saa === 0 || sbb === 0 ? 0 : sab / Math.sqrt(saa * sbb);
  },
};

if (typeof module !== "undefined") module.exports = Filtros;
