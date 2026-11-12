// Preset de Tailwind de KipuControl — sistema «Andean Operations Modernity» (diseño de Stitch, v2.12).
// Generado desde el tailwind.config de las pantallas de Stitch de la landing + alias de marca (navy, royal, sun, soft-blue, ok).
// Uso: apps/landing/tailwind.config.ts → presets: [kipucontrolPreset]
import type { Config } from 'tailwindcss'

const kipucontrolPreset = {
  darkMode: 'class',
  content: [],
  theme: { extend: {
      "colors": {
        "background": "#f8f9ff",
        "surface-container-high": "#dee9fc",
        "on-secondary-fixed-variant": "#5d4200",
        "primary-fixed": "#d6e3ff",
        "primary-container": "#0a3a73",
        "surface-container": "#e5eeff",
        "on-error-container": "#93000a",
        "outline-variant": "#c3c6d1",
        "primary-fixed-dim": "#aac7ff",
        "on-background": "#111c2a",
        "error-container": "#ffdad6",
        "surface-tint": "#395e99",
        "on-primary-fixed-variant": "#1d4680",
        "on-tertiary-fixed": "#00210c",
        "error": "#ba1a1a",
        "surface-container-highest": "#d8e3f7",
        "inverse-surface": "#263140",
        "surface": "#f8f9ff",
        "secondary-container": "#fdbc13",
        "surface-container-low": "#eff4ff",
        "on-tertiary-fixed-variant": "#005228",
        "tertiary": "#002c13",
        "tertiary-fixed": "#82fba5",
        "on-primary": "#ffffff",
        "on-surface": "#111c2a",
        "inverse-on-surface": "#eaf1ff",
        "surface-dim": "#cfdbee",
        "on-tertiary-container": "#3fbb6d",
        "primary": "#00244f",
        "surface-container-lowest": "#ffffff",
        "surface-variant": "#d8e3f7",
        "secondary-fixed-dim": "#fdbc13",
        "tertiary-fixed-dim": "#65de8c",
        "on-secondary": "#ffffff",
        "outline": "#737781",
        "on-primary-fixed": "#001b3e",
        "inverse-primary": "#aac7ff",
        "secondary-fixed": "#ffdea3",
        "tertiary-container": "#004520",
        "on-secondary-container": "#6b4d00",
        "on-secondary-fixed": "#261900",
        "on-primary-container": "#82a6e5",
        "on-tertiary": "#ffffff",
        "surface-bright": "#f8f9ff",
        "secondary": "#7a5900",
        "on-surface-variant": "#434750",
        "on-error": "#ffffff",
        "navy": "#0A3A73",
        "royal": "#11509A",
        "sun": "#F4B400",
        "on-sun": "#2B1F00",
        "soft-blue": "#EAF3FC",
        "ok": "#22A55A",
        "canvas": "#F7F9FC",
        "line": "#E4E8EF",
        "ink": "#15202E",
        "slate": "#4A5568"
      },
      "borderRadius": {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      "spacing": {
        "margin": "2rem",
        "space-md": "1rem",
        "space-xl": "2.5rem",
        "space-lg": "1.5rem",
        "space-sm": "0.5rem",
        "margin-mobile": "1rem",
        "space-xs": "0.25rem",
        "gutter-mobile": "1rem",
        "gutter": "1.5rem"
      },
      "fontFamily": {
        "display-hero": [
          "Plus Jakarta Sans"
        ],
        "body-sm": [
          "Plus Jakarta Sans"
        ],
        "label-caps": [
          "Plus Jakarta Sans"
        ],
        "body-md": [
          "Plus Jakarta Sans"
        ],
        "body-lg": [
          "Plus Jakarta Sans"
        ],
        "display-hero-mobile": [
          "Plus Jakarta Sans"
        ],
        "metric-display": [
          "Plus Jakarta Sans"
        ],
        "headline-lg-mobile": [
          "Plus Jakarta Sans"
        ],
        "headline-sm": [
          "Plus Jakarta Sans"
        ],
        "title-lg": [
          "Plus Jakarta Sans"
        ],
        "headline-md": [
          "Plus Jakarta Sans"
        ],
        "headline-lg": [
          "Plus Jakarta Sans"
        ],
        "sans": [
          "\"Plus Jakarta Sans\"",
          "system-ui",
          "sans-serif"
        ]
      },
      "fontSize": {
        "display-hero": [
          "60px",
          {
            "lineHeight": "68px",
            "letterSpacing": "-0.03em",
            "fontWeight": "800"
          }
        ],
        "body-sm": [
          "13px",
          {
            "lineHeight": "18px",
            "fontWeight": "500"
          }
        ],
        "label-caps": [
          "11px",
          {
            "lineHeight": "14px",
            "letterSpacing": "0.06em",
            "fontWeight": "700"
          }
        ],
        "body-md": [
          "15px",
          {
            "lineHeight": "24px",
            "fontWeight": "400"
          }
        ],
        "body-lg": [
          "17px",
          {
            "lineHeight": "27px",
            "fontWeight": "400"
          }
        ],
        "display-hero-mobile": [
          "40px",
          {
            "lineHeight": "48px",
            "letterSpacing": "-0.025em",
            "fontWeight": "800"
          }
        ],
        "metric-display": [
          "34px",
          {
            "lineHeight": "40px",
            "letterSpacing": "-0.02em",
            "fontWeight": "800"
          }
        ],
        "headline-lg-mobile": [
          "30px",
          {
            "lineHeight": "38px",
            "letterSpacing": "-0.02em",
            "fontWeight": "700"
          }
        ],
        "headline-sm": [
          "22px",
          {
            "lineHeight": "30px",
            "letterSpacing": "-0.01em",
            "fontWeight": "600"
          }
        ],
        "title-lg": [
          "19px",
          {
            "lineHeight": "26px",
            "letterSpacing": "-0.005em",
            "fontWeight": "600"
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
        "headline-lg": [
          "40px",
          {
            "lineHeight": "48px",
            "letterSpacing": "-0.02em",
            "fontWeight": "700"
          }
        ]
      }
    } },
} satisfies Config

export default kipucontrolPreset
