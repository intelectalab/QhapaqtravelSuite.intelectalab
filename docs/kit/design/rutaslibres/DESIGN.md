<!-- Kit KipuControl v2.11 · Sistema de diseño de Rutas Libres Perú (rutaslibres.pe), exportado de Stitch tal como lo definió el equipo.
     Reemplaza la paleta carmesí, dorado y textil de la v2.8 (ver PROMPT-STITCH-RUTASLIBRES.md, ahora histórico).
     Tokens para código: tokens.json y tailwind.preset.ts de esta carpeta. Prototipo: docs/prototipo/assets/js/modules/vitrina.js.
     Resumen en español: cobalto #1D4ED8 para navegación y confianza; coral #F95738 solo para reservar y precios;
     esmeralda #059669 para verificado; fondo #F8FAFC; texto #0F172A; Plus Jakarta Sans; tarjetas de 1.5–2rem; sin motivos folclóricos. -->

---
name: Luminous Nomad
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#434655'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#747686'
  outline-variant: '#c4c5d7'
  surface-tint: '#2151da'
  primary: '#0037b0'
  on-primary: '#ffffff'
  primary-container: '#1d4ed8'
  on-primary-container: '#cad3ff'
  inverse-primary: '#b7c4ff'
  secondary: '#b5260b'
  on-secondary: '#ffffff'
  secondary-container: '#fc593a'
  on-secondary-container: '#580900'
  tertiary: '#004f35'
  on-tertiary: '#ffffff'
  tertiary-container: '#006948'
  on-tertiary-container: '#76eab6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b7c4ff'
  on-primary-fixed: '#001551'
  on-primary-fixed-variant: '#0039b5'
  secondary-fixed: '#ffdad3'
  secondary-fixed-dim: '#ffb4a5'
  on-secondary-fixed: '#3e0400'
  on-secondary-fixed-variant: '#8e1500'
  tertiary-fixed: '#85f8c4'
  tertiary-fixed-dim: '#68dba9'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#005137'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 56px
    fontWeight: '800'
    lineHeight: 64px
    letterSpacing: -0.03em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0.005em
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 3rem
  margin-mobile: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system embodies an airy, modern, premium travel and discovery platform. It merges the visual polish of premier global booking platforms with the warmth of curated, boutique field expeditions. The aesthetic rejects decorative clutter, rigid borders, and cliché folkloric motifs in favor of editorial elegance, generous whitespace, pristine micro-details, and intuitive spatial layering.

The emotional signature is inviting, inspiring, and friction-free: users feel the thrill of departure balanced by utter confidence in booking reliability. The visual language blends lightweight glassmorphism (frosted floating search pods and navigation capsules) with soft structural geometry, vibrant sunburst conversion points, and calm, stone-tinted atmospheric backdrops.

## Colors

The palette establishes an immediate tension between serene expedition skies and high-heat conversion action:

- **Primary (`#1D4ED8`)**: Oceanic cobalt blue serving as the structural anchor, brand accents, selected filter states, interactive link headers, and primary active controls.
- **Secondary (`#F95738`)**: Sunset coral/terracotta dedicated strictly to critical conversion touchpoints: booking CTAs, "Instant Reserve" badges, price highlights, and celebratory milestone states.
- **Tertiary (`#059669`)**: Emerald green reserved exclusively for trust and assurance: "Certified Local Host", "Verified Itinerary", positive review ratings, and free-cancellation guarantees.
- **Neutral (`#F8FAFC`)**: A calm, balanced off-white stone base, avoiding sterile digital white. Supported by `#0F172A` (deep slate) for high-contrast primary typography, `#64748B` (slate gray) for supporting editorial metadata, and `#E2E8F0` for featherweight dividers and card perimeters.

## Typography

Plus Jakarta Sans is utilized across all editorial, navigational, and technical copy tiers to maintain typographic unity and clean, modern clarity. 

- **Display & Headlines**: Generous negative letter-spacing (`-0.015em` to `-0.03em`) provides tight, authoritative phrasing for destination showcases and title banners.
- **Body Text**: Tuned for high legibility during itinerary skimming with comfortable line-height ratios (1.55–1.6) and balanced ink-traps that maintain clarity across handheld retina displays.
- **Labels & Micro-Tags**: Subtle uppercase tracking is reserved only for `label-sm` category badges (e.g., "DAY TRIP", "SMALL GROUP"), while functional tags and prices preserve natural sentence casing for immediate readability.

## Layout & Spacing

The layout philosophy centers on a responsive 12-column fluid grid on desktop (`> 1024px`) with a max container width of 1360px to preserve editorial balance. Tablet (`768px - 1023px`) transitions smoothly to an 8-column layout with 24px gutters, while Mobile (`< 768px`) leverages a 4-column layout with 16px gutters and edge-to-edge swipe containers.

Horizontal rhythms emphasize breathing room between visual elements, alternating dense, scannable experience cards with open panoramic photography. Component paddings rely strictly on the `space-*` scale to maintain rhythm across nested search widgets, experience showcases, and checkout summaries.

## Elevation & Depth

Spatial layering relies on a fusion of ambient light shadows and translucent frosted surfaces, avoiding stark drop shadows:

- **Surface 0 (Canvas)**: Neutral background `#F8FAFC`.
- **Surface 1 (Base Cards & Modules)**: Pure white `#FFFFFF` paired with an ultra-light stroke `rgba(226, 232, 240, 0.8)` and subtle diffuse elevation: `0 4px 20px -2px rgba(15, 23, 42, 0.04)`.
- **Surface 2 (Interactive Floating Elements)**: Floating search filters, host summary pods, and booking navigation capsules utilize frosted glassmorphism: `background: rgba(255, 255, 255, 0.82)`, `backdrop-filter: blur(16px)`, `border: 1px solid rgba(255, 255, 255, 0.6)`, elevated with `0 12px 32px -4px rgba(15, 23, 42, 0.08)`.
- **Surface 3 (Overlays, Bottom Sheets & Modals)**: Deep spatial priority with `0 24px 48px -12px rgba(15, 23, 42, 0.14)` atop a dimmed backdrop of `rgba(15, 23, 42, 0.45)` with `backdrop-filter: blur(4px)`.

## Shapes

The interface embraces organic curvature without feeling juvenile or bulbous. Curvatures scale according to component scale:

- Primary experience discovery cards and hero image carousels utilize generous `1.5rem` (`rounded-2xl`) to `2rem` (`rounded-3xl`) bounds, creating natural photo cutouts.
- Form inputs, inner containers, and interactive dropdowns rely on crisp `0.75rem` to `1rem` corner radii.
- Micro-elements such as category filters, guide verification tags, pricing chips, and floating action triggers use full pill geometries (`border-radius: 9999px`) to invite thumb and mouse interaction.

## Components

### Buttons & Conversion Actions
- **Primary Booking CTA**: High-energy Sunset Orange (`#F95738`), pill-shaped, pure white bold text, with subtle bottom-edge warmth. On hover: slight vertical lift (`translateY(-1px)`) and amplified warm glow (`box-shadow: 0 8px 24px -4px rgba(249, 87, 56, 0.35)`).
- **Secondary Action**: Crisp white surface, `#0F172A` text, 1px border `#E2E8F0`, transitioning on hover to `#F8FAFC` with border `#CBD5E1`.
- **Ghost/Capsule Actions**: Transparent background, `#1D4ED8` text, transitioning to `rgba(29, 78, 216, 0.08)` on hover.

### Experience Cards
- Encapsulated within smooth `1.5rem` surfaces with hidden overflows.
- Aspect ratio 4:3 for preview photography with an integrated top-right floating pill bookmark/favorite button (frosted glass with dynamic SVG heart).
- Badge placements sit top-left: Emerald green verified badge (`#059669` fill or tint) or category pill.
- Base card body features rating badge (bold star + score + review count in `#64748B`), bold title in `headline-sm`, metadata string (duration, languages, difficulty), and lower price lockup ("from **$X** / person" in bold coral/slate).

### Chips & Pill Toggles
- Category selector chips feature a pill boundary with an optional minimal icon.
- Unselected state: Pure white background, `1px solid #E2E8F0`, `#64748B` text.
- Selected state: Pure Slate `#0F172A` or Cobalt `#1D4ED8` fill with crisp white text and zero border outline.

### Search Engine Pod (Floating Island)
- A unified pill-shaped or rounded-2xl horizontal floating deck on desktop, dividing into Destination, Dates, and Guests segments via vertical hairline dividers (`#E2E8F0`).
- Hovering segments provides soft rectangular pill highlights (`#F1F5F9`).
- Terminated on the right by a high-contrast circular or pill search execution button in Secondary Orange or Cobalt Blue.

### Badges & Verification Elements
- **Certified Guide Micro-Badge**: Pale emerald background (`#ECFDF5`), bold emerald text (`#059669`), paired with a verified shield micro-icon.
- **Status & Urgency Flags**: "Likely to Sell Out" or "Few Spots Left" rendered in soft coral tint (`#FFF1EE`) with `#F95738` copy.
- **Strictly No Heavy Borders**: Dividers and bounding outlines must never exceed 1px solid stroke weight.