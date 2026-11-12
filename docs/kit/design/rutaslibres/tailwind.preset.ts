// Preset de Tailwind de Rutas Libres — sistema «Luminous Nomad» (diseño de Stitch, v2.11).
// Generado desde el tailwind.config de las pantallas de Stitch + alias de marca (cobalt, coral, emerald) y sombras de DESIGN.md.
// Uso: apps/vitrina/tailwind.config.ts → presets: [rutasLibresPreset]
import type { Config } from 'tailwindcss'

const rutasLibresPreset = {
  darkMode: 'class',
  content: [],
  theme: { extend: {
      "colors": {
        "surface-container-highest": "#e0e3e5",
        "tertiary-fixed-dim": "#68dba9",
        "on-primary-container": "#cad3ff",
        "outline-variant": "#c4c5d7",
        "inverse-on-surface": "#eff1f3",
        "error-container": "#ffdad6",
        "outline": "#747686",
        "on-tertiary": "#ffffff",
        "primary": "#0037b0",
        "inverse-surface": "#2d3133",
        "secondary": "#b5260b",
        "secondary-container": "#fc593a",
        "surface-dim": "#d8dadc",
        "on-surface-variant": "#434655",
        "surface-container-low": "#f2f4f6",
        "on-secondary": "#ffffff",
        "background": "#f7f9fb",
        "on-secondary-fixed": "#3e0400",
        "on-tertiary-container": "#76eab6",
        "tertiary-container": "#006948",
        "surface-container-high": "#e6e8ea",
        "surface-container-lowest": "#ffffff",
        "inverse-primary": "#b7c4ff",
        "secondary-fixed": "#ffdad3",
        "primary-fixed": "#dce1ff",
        "surface-tint": "#2151da",
        "on-primary-fixed": "#001551",
        "on-error-container": "#93000a",
        "secondary-fixed-dim": "#ffb4a5",
        "primary-fixed-dim": "#b7c4ff",
        "error": "#ba1a1a",
        "on-tertiary-fixed": "#002114",
        "on-secondary-container": "#580900",
        "on-error": "#ffffff",
        "on-primary-fixed-variant": "#0039b5",
        "tertiary-fixed": "#85f8c4",
        "tertiary": "#004f35",
        "on-background": "#191c1e",
        "on-secondary-fixed-variant": "#8e1500",
        "surface-bright": "#f7f9fb",
        "on-tertiary-fixed-variant": "#005137",
        "surface": "#f7f9fb",
        "primary-container": "#1d4ed8",
        "surface-variant": "#e0e3e5",
        "on-primary": "#ffffff",
        "on-surface": "#191c1e",
        "surface-container": "#eceef0",
        "cobalt": "#1D4ED8",
        "coral": {
          "DEFAULT": "#F95738",
          "hover": "#E0452A"
        },
        "emerald": "#059669",
        "ink": "#0F172A",
        "muted": "#64748B",
        "line": "#E2E8F0",
        "canvas": "#F8FAFC"
      },
      "borderRadius": {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px",
        "card": "1.5rem",
        "panel": "2rem",
        "input": "0.875rem"
      },
      "spacing": {
        "space-xs": "0.25rem",
        "margin": "3rem",
        "space-sm": "0.5rem",
        "space-xl": "2.5rem",
        "space-md": "1rem",
        "space-lg": "1.5rem",
        "gutter": "1.5rem",
        "margin-mobile": "1.25rem",
        "gutter-mobile": "1rem"
      },
      "fontFamily": {
        "headline-xl": [
          "Plus Jakarta Sans"
        ],
        "label-sm": [
          "Plus Jakarta Sans"
        ],
        "headline-lg-mobile": [
          "Plus Jakarta Sans"
        ],
        "label-md": [
          "Plus Jakarta Sans"
        ],
        "body-lg": [
          "Plus Jakarta Sans"
        ],
        "headline-lg": [
          "Plus Jakarta Sans"
        ],
        "headline-md": [
          "Plus Jakarta Sans"
        ],
        "body-md": [
          "Plus Jakarta Sans"
        ],
        "label-lg": [
          "Plus Jakarta Sans"
        ],
        "headline-xl-mobile": [
          "Plus Jakarta Sans"
        ],
        "headline-sm": [
          "Plus Jakarta Sans"
        ],
        "body-sm": [
          "Plus Jakarta Sans"
        ]
      },
      "fontSize": {
        "headline-xl": [
          "56px",
          {
            "lineHeight": "64px",
            "letterSpacing": "-0.03em",
            "fontWeight": "800"
          }
        ],
        "label-sm": [
          "11px",
          {
            "lineHeight": "14px",
            "letterSpacing": "0.04em",
            "fontWeight": "700"
          }
        ],
        "headline-lg-mobile": [
          "28px",
          {
            "lineHeight": "36px",
            "letterSpacing": "-0.015em",
            "fontWeight": "700"
          }
        ],
        "label-md": [
          "12px",
          {
            "lineHeight": "16px",
            "letterSpacing": "0.02em",
            "fontWeight": "600"
          }
        ],
        "body-lg": [
          "18px",
          {
            "lineHeight": "28px",
            "letterSpacing": "-0.005em",
            "fontWeight": "400"
          }
        ],
        "headline-lg": [
          "40px",
          {
            "lineHeight": "48px",
            "letterSpacing": "-0.02em",
            "fontWeight": "700"
          }
        ],
        "headline-md": [
          "28px",
          {
            "lineHeight": "36px",
            "letterSpacing": "-0.015em",
            "fontWeight": "700"
          }
        ],
        "body-md": [
          "15px",
          {
            "lineHeight": "24px",
            "letterSpacing": "0em",
            "fontWeight": "400"
          }
        ],
        "label-lg": [
          "14px",
          {
            "lineHeight": "20px",
            "letterSpacing": "0.01em",
            "fontWeight": "600"
          }
        ],
        "headline-xl-mobile": [
          "36px",
          {
            "lineHeight": "44px",
            "letterSpacing": "-0.02em",
            "fontWeight": "800"
          }
        ],
        "headline-sm": [
          "20px",
          {
            "lineHeight": "28px",
            "letterSpacing": "-0.01em",
            "fontWeight": "600"
          }
        ],
        "body-sm": [
          "13px",
          {
            "lineHeight": "20px",
            "letterSpacing": "0.005em",
            "fontWeight": "400"
          }
        ]
      },
      "boxShadow": {
        "card": "0 4px 20px -2px rgba(15,23,42,.04)",
        "float": "0 12px 32px -4px rgba(15,23,42,.08)",
        "coral": "0 8px 24px -4px rgba(249,87,56,.35)"
      },
      "maxWidth": {
        "site": "1360px"
      },
      "backdropBlur": {
        "glass": "16px"
      }
    } },
} satisfies Config

export default rutasLibresPreset
