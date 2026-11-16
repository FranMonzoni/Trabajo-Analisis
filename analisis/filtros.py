"""
Suavizado de la cotización del dólar blue con dos filtros digitales:
media móvil simple (SMA) y suavizado exponencial (EMA).

Calcula ambas salidas con la ecuación en diferencias, las verifica contra
scipy.signal, obtiene la respuesta en frecuencia y el retardo a partir de las
funciones de transferencia H(z) y genera las figuras del informe.

Uso:  python analisis/filtros.py
"""
import csv
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import FancyArrowPatch, Rectangle, Circle
from scipy import signal

RAIZ = Path(__file__).resolve().parent.parent
FIG = RAIZ / "analisis" / "figuras"
FIG.mkdir(parents=True, exist_ok=True)

N = 5                 # ventana de la media móvil (una semana hábil)
ALFA = 2 / (N + 1)    # constante de suavizado equivalente: 1/3
BETA = 1 - ALFA


# ---------------------------------------------------------------- datos
def cargar():
    with open(RAIZ / "datos" / "dolar_blue.csv", encoding="utf-8") as f:
        filas = list(csv.DictReader(f))
    return [r["fecha"] for r in filas], np.array([float(r["venta"]) for r in filas])


# ------------------------------------------- filtros (ecuación en diferencias)
def media_movil(x, n_ventana):
    """y[n] = (1/N) * suma de las últimas N muestras. Definida desde n = N-1."""
    y = np.full(len(x), np.nan)
    for n in range(n_ventana - 1, len(x)):
        y[n] = sum(x[n - k] for k in range(n_ventana)) / n_ventana
    return y


def suavizado_exponencial(x, alfa):
    """y[n] = alfa*x[n] + (1-alfa)*y[n-1], con y[0] = x[0]."""
    y = np.empty(len(x))
    y[0] = x[0]
    for n in range(1, len(x)):
        y[n] = alfa * x[n] + (1 - alfa) * y[n - 1]
    return y


# --------------------------------------------- análisis con la transformada Z
def H_sma(w, n_ventana=N):
    z = np.exp(1j * w)
    return sum(z ** (-k) for k in range(n_ventana)) / n_ventana


def H_ema(w, alfa=ALFA):
    z = np.exp(1j * w)
    return alfa / (1 - (1 - alfa) * z ** (-1))


def retardo_ema(w, alfa=ALFA):
    """Retardo de grupo analítico del EMA, en muestras (días)."""
    b = 1 - alfa
    return b * (np.cos(w) - b) / (1 - 2 * b * np.cos(w) + b * b)


def retardo_medido(y, x, desde, max_k=6):
    """Desplazamiento k que maximiza la correlación entre y[n] y x[n-k].
    Se refina con una parábola por los tres puntos alrededor del máximo."""
    r = []
    for k in range(max_k + 1):
        r.append(np.corrcoef(y[desde:], x[desde - k:len(x) - k])[0, 1])
    k0 = int(np.argmax(r))
    if 0 < k0 < max_k:
        a, b, c = r[k0 - 1], r[k0], r[k0 + 1]
        k_frac = k0 + 0.5 * (a - c) / (a - 2 * b + c)
    else:
        k_frac = float(k0)
    return k0, k_frac, r


def main():
    fechas, x = cargar()
    sma = media_movil(x, N)
    ema = suavizado_exponencial(x, ALFA)

    # Verificación independiente con scipy.signal.lfilter
    sma_sp = signal.lfilter(np.ones(N) / N, [1.0], x)
    ema_sp = signal.lfilter([ALFA], [1.0, -BETA], x, zi=[BETA * x[0]])[0]
    err_sma = np.nanmax(np.abs(sma[N - 1:] - sma_sp[N - 1:]))
    err_ema = np.max(np.abs(ema - ema_sp))

    # Verificación de H(z): fórmula analítica vs scipy.signal.freqz
    w = np.linspace(1e-4, np.pi, 2000)
    _, h1 = signal.freqz(np.ones(N) / N, [1.0], worN=w)
    _, h2 = signal.freqz([ALFA], [1.0, -BETA], worN=w)
    err_h = max(np.max(np.abs(h1 - H_sma(w))), np.max(np.abs(h2 - H_ema(w))))
    _, gd2 = signal.group_delay(([ALFA], [1.0, -BETA]), w=w)
    err_gd = np.max(np.abs(gd2 - retardo_ema(w)))

    # Métricas sobre los datos (se descartan 10 días de transitorio inicial)
    d0 = 10
    k_sma, kf_sma, r_sma = retardo_medido(sma, x, d0)
    k_ema, kf_ema, r_ema = retardo_medido(ema, x, d0)
    rug = lambda v: float(np.std(np.diff(v[d0:])))
    rms = lambda v: float(np.sqrt(np.mean((x[d0:] - v[d0:]) ** 2)))

    # Respuesta al escalón unitario (porcentaje alcanzado en cada día)
    n = np.arange(0, 13)
    esc_sma = np.minimum(n + 1, N) / N
    esc_ema = 1 - BETA ** (n + 1)

    res = {
        "N": N, "alfa": ALFA, "muestras": len(x),
        "desde": fechas[0], "hasta": fechas[-1],
        "min": float(x.min()), "max": float(x.max()),
        "tabla_manual": [
            {"n": i, "fecha": fechas[i], "x": float(x[i]),
             "sma": None if np.isnan(sma[i]) else round(float(sma[i]), 2),
             "ema": round(float(ema[i]), 2)} for i in range(8)],
        "ultimo": {"x": float(x[-1]), "sma": round(float(sma[-1]), 2),
                   "ema": round(float(ema[-1]), 2)},
        "error_vs_scipy": {"sma": float(err_sma), "ema": float(err_ema),
                           "H": float(err_h), "retardo_grupo": float(err_gd)},
        "retardo_teorico_w0": {"sma": (N - 1) / 2, "ema": BETA / ALFA},
        "retardo_ema_por_periodo": {
            str(T): round(float(retardo_ema(2 * np.pi / T)), 3) for T in (40, 20, 10, 5)},
        "ganancia_por_periodo": {
            str(T): {"sma": round(float(abs(H_sma(2 * np.pi / T))), 3),
                     "ema": round(float(abs(H_ema(2 * np.pi / T))), 3)}
            for T in (40, 20, 10, 5, 2)},
        "retardo_medido": {
            "sma": {"k": k_sma, "k_frac": round(kf_sma, 2), "r": [round(v, 3) for v in r_sma]},
            "ema": {"k": k_ema, "k_frac": round(kf_ema, 2), "r": [round(v, 3) for v in r_ema]}},
        "rugosidad": {"x": rug(x), "sma": rug(sma), "ema": rug(ema)},
        "rms_residuo": {"sma": rms(sma), "ema": rms(ema)},
        "varianza_ruido": {"sma": 1 / N, "ema": ALFA / (2 - ALFA)},
        "escalon": {"sma": [round(float(v), 3) for v in esc_sma],
                    "ema": [round(float(v), 3) for v in esc_ema]},
        "transitorio_1pct_dias": float(np.log(0.01) / np.log(BETA)),
    }
    (RAIZ / "analisis" / "resultados.json").write_text(
        json.dumps(res, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(res, indent=2, ensure_ascii=False))

    figuras(fechas, x, sma, ema, w, n, esc_sma, esc_ema)


# ---------------------------------------------------------------- figuras
AZUL, NARANJA, GRIS = "#1f4fb4", "#d9660a", "#555555"


def figuras(fechas, x, sma, ema, w, n, esc_sma, esc_ema):
    plt.rcParams.update({
        "font.family": "serif", "font.serif": ["Liberation Serif", "Times New Roman", "DejaVu Serif"],
        "mathtext.fontset": "stix", "font.size": 10, "axes.grid": True,
        "grid.alpha": 0.3, "axes.spines.top": False, "axes.spines.right": False})

    # Figura 1: diagramas en bloques
    fig, axs = plt.subplots(1, 2, figsize=(7.2, 1.75))
    for ax in axs:
        ax.set_xlim(0, 10); ax.set_ylim(0, 4); ax.axis("off")

    def flecha(ax, a, b):
        ax.add_patch(FancyArrowPatch(a, b, arrowstyle="-|>", mutation_scale=9, lw=0.9, color="k"))

    def caja(ax, xy, wd, ht, txt):
        ax.add_patch(Rectangle(xy, wd, ht, fill=False, lw=0.9))
        ax.text(xy[0] + wd / 2, xy[1] + ht / 2, txt, ha="center", va="center", fontsize=9)

    ax = axs[0]
    ax.set_title("Media móvil (FIR): sin realimentación", fontsize=9.5)
    ax.text(0.1, 3.1, "$x[n]$", va="center", fontsize=9)
    xs = [1.5, 3.5, 5.5, 7.5]
    ax.plot([0.9, 9.0], [3.1, 3.1], "k", lw=0.9)
    for xx in xs:
        caja(ax, (xx, 2.7), 1.0, 0.8, "$z^{-1}$")
    for xx in [1.2, 3.0, 5.0, 7.0, 9.0]:
        ax.plot([xx, xx], [3.1, 1.75], "k", lw=0.9)
    caja(ax, (0.9, 0.95), 8.4, 0.8, r"$\Sigma$  y multiplicar por $1/5$")
    flecha(ax, (5.1, 0.95), (5.1, 0.25))
    ax.text(5.3, 0.4, "$y[n]$", fontsize=9)

    ax = axs[1]
    ax.set_title("Suavizado exponencial (IIR): con realimentación", fontsize=9.5)
    ax.text(0.1, 3.0, "$x[n]$", va="center", fontsize=9)
    flecha(ax, (0.9, 3.0), (1.6, 3.0)); caja(ax, (1.6, 2.6), 1.1, 0.8, r"$\alpha$")
    flecha(ax, (2.7, 3.0), (4.1, 3.0))
    ax.add_patch(Circle((4.4, 3.0), 0.3, fill=False, lw=0.9)); ax.text(4.4, 3.0, "+", ha="center", va="center")
    flecha(ax, (4.7, 3.0), (9.3, 3.0)); ax.text(9.0, 3.3, "$y[n]$", fontsize=9)
    ax.plot([7.8, 7.8], [3.0, 1.2], "k", lw=0.9)
    flecha(ax, (7.8, 1.2), (7.1, 1.2)); caja(ax, (6.1, 0.8), 1.0, 0.8, "$z^{-1}$")
    flecha(ax, (6.1, 1.2), (5.4, 1.2)); caja(ax, (4.0, 0.8), 1.4, 0.8, r"$1-\alpha$")
    ax.plot([4.0, 3.4], [1.2, 1.2], "k", lw=0.9); ax.plot([3.4, 3.4], [1.2, 2.2], "k", lw=0.9)
    ax.plot([3.4, 4.4], [2.2, 2.2], "k", lw=0.9); flecha(ax, (4.4, 2.2), (4.4, 2.7))
    fig.tight_layout()
    fig.savefig(FIG / "fig1_bloques.png", dpi=220); plt.close(fig)

    # Figura 2: serie real y salidas de ambos filtros
    fig, ax = plt.subplots(figsize=(7.2, 2.6))
    t = np.arange(len(x))
    ax.plot(t, x, color=GRIS, lw=0.9, marker="o", ms=2.3, label="Dólar blue (venta), dato diario")
    ax.plot(t, sma, color=AZUL, lw=1.8, label=f"Media móvil, N = {N}")
    ax.plot(t, ema, color=NARANJA, lw=1.8, ls="--", label="Suavizado exponencial, α = 1/3")
    marcas = [i for i in range(len(x)) if i == 0 or fechas[i][5:7] != fechas[i - 1][5:7]]
    ax.set_xticks(list(range(0, len(x), 10)))
    ax.set_xticklabels([f"{fechas[i][8:]}/{fechas[i][5:7]}" for i in range(0, len(x), 10)])
    ax.set_xlabel("Fecha (días hábiles, 2026)"); ax.set_ylabel("Cotización [$ por USD]")
    ax.legend(fontsize=8.5, loc="upper left", frameon=False)
    fig.tight_layout(); fig.savefig(FIG / "fig2_serie.png", dpi=220); plt.close(fig)

    # Figura 3: magnitud, retardo y respuesta al escalón
    fig, axs = plt.subplots(1, 3, figsize=(7.2, 2.3))
    f = w / (2 * np.pi)
    axs[0].plot(f, np.abs(H_sma(w)), color=AZUL, lw=1.6, label="Media móvil")
    axs[0].plot(f, np.abs(H_ema(w)), color=NARANJA, lw=1.6, ls="--", label="Exponencial")
    axs[0].set_xlabel("Frecuencia [ciclos/día]"); axs[0].set_ylabel("Ganancia $|H(e^{j\\omega})|$")
    axs[0].set_title("(a) Respuesta en frecuencia", fontsize=9.5); axs[0].legend(fontsize=8, frameon=False)
    axs[1].plot(f, np.full_like(f, (N - 1) / 2), color=AZUL, lw=1.6)
    axs[1].plot(f, retardo_ema(w), color=NARANJA, lw=1.6, ls="--")
    axs[1].set_xlabel("Frecuencia [ciclos/día]"); axs[1].set_ylabel("Retardo de grupo [días]")
    axs[1].set_title("(b) Retraso según la frecuencia", fontsize=9.5)
    axs[2].step(n, 100 * esc_sma, where="post", color=AZUL, lw=1.6)
    axs[2].step(n, 100 * esc_ema, where="post", color=NARANJA, lw=1.6, ls="--")
    axs[2].set_xlabel("Días desde el salto"); axs[2].set_ylabel("Salto reflejado [%]")
    axs[2].set_title("(c) Respuesta al escalón", fontsize=9.5); axs[2].set_ylim(0, 105)
    fig.tight_layout(); fig.savefig(FIG / "fig3_frecuencia.png", dpi=220); plt.close(fig)


if __name__ == "__main__":
    main()
