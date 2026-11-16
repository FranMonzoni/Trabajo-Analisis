# Suavizar el dólar con la Transformada Z

Trabajo de Análisis Numérico (UTN, Facultad Regional San Francisco, 2026).

Se suaviza la cotización real del dólar blue con dos filtros digitales, una media móvil y un suavizado exponencial. Con la Transformada Z se obtiene la función de transferencia de cada uno y se calcula cuánto retraso introduce.

## Ver la presentación

Abrir `index.html` en el navegador. No necesita instalación, servidor ni conexión a internet.

Para publicarla con GitHub Pages: *Settings → Pages → Deploy from a branch → main, carpeta / (root)*. Queda en `https://franmonzoni.github.io/Trabajo-Analisis/`.

En la barra superior se mueven N (días de la media móvil) y α (constante del suavizado exponencial). Con la casilla "Igualar el retraso" marcada, α se calcula como 2/(N+1), que es el valor con el que ambos filtros atrasan lo mismo ante tendencias lentas.

## Contenido

| Ruta | Qué es |
|---|---|
| `index.html`, `css/`, `js/`, `fuentes/` | Presentación interactiva |
| `js/filtros.js` | Los dos filtros y las fórmulas que salen de H(z) |
| `datos/dolar_blue.csv` | Venta del dólar blue, 75 días hábiles (03/08/2026 al 13/11/2026) |
| `analisis/filtros.py` | Script de Python del informe: filtros, verificación con SciPy, métricas y figuras |
| `analisis/resultados.json` | Resultados numéricos que usa el informe |
| `analisis/figuras/` | Figuras del informe |

## Repetir el análisis

```
pip install numpy scipy matplotlib
python analisis/filtros.py
```

## Resultados principales (N = 5, α = 1/3)

| | Media móvil | Suavizado exponencial |
|---|---|---|
| Función de transferencia | H(z) = (1 + z⁻¹ + z⁻² + z⁻³ + z⁻⁴) / 5 | H(z) = (1/3) / (1 − (2/3) z⁻¹) |
| Retraso medio (teórico) | 2 días | 2 días |
| Retraso medido en los datos | 2 días | 1 día |
| Varianza de ruido blanco que deja pasar | 20 % | 20 % |
| Variación diaria típica (dato: $6,24) | $2,15 | $2,35 |

## Fuentes

Los datos son de [ArgentinaDatos](https://argentinadatos.com) (`/v1/cotizaciones/dolares/blue`), consultados el 16/11/2026. Las tipografías Archivo y Sura son de Omnibus-Type, con licencia SIL Open Font License.
