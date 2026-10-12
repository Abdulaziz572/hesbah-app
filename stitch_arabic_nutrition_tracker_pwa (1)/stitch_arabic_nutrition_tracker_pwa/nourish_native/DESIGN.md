---
name: Nourish Native
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3d4a42'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6d7a72'
  outline-variant: '#bccac0'
  surface-tint: '#006c4a'
  primary: '#006948'
  on-primary: '#ffffff'
  primary-container: '#00855d'
  on-primary-container: '#f5fff7'
  inverse-primary: '#68dba9'
  secondary: '#4648d4'
  on-secondary: '#ffffff'
  secondary-container: '#6063ee'
  on-secondary-container: '#fffbff'
  tertiary: '#825100'
  on-tertiary: '#ffffff'
  tertiary-container: '#a36700'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#85f8c4'
  primary-fixed-dim: '#68dba9'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#005137'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display:
    fontFamily: IBM Plex Sans
    fontSize: 34px
    fontWeight: '700'
    lineHeight: 41px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: IBM Plex Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: IBM Plex Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: IBM Plex Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 25px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: IBM Plex Sans
    fontSize: 17px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: IBM Plex Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 21px
    letterSpacing: 0em
  body-sm:
    fontFamily: IBM Plex Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  label-lg:
    fontFamily: IBM Plex Sans
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: IBM Plex Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.03em
  metric-numeral:
    fontFamily: IBM Plex Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.25rem
  space-xl: 1.5rem
---

## Brand & Style

This design system is engineered as an iOS-native Progressive Web App (PWA) tailored for holistic nutrition, macro logging, and dietary wellness. The core aesthetic is built on an **iOS-inspired Minimalist Glass & Tonal** foundation, prioritizing calm clarity over visual noise to eliminate tracking friction and dietary anxiety.

### Personality & Emotional Tenor
- **Calm & Measured:** Replaces aggressive fitness aesthetics with organic, restorative tones centered around mindful nourishment.
- **RTL-First Equilibrium:** Built natively for bidirectional reading flows, anchored in Arabic typography hierarchy and balanced visual weighting from right to left.
- **Clinical Precision with Tactile Warmth:** High-legibility data displays paired with softly nested card surfaces and fluid micro-interactions.

### Target Audience
Mobile-first users seeking an unobtrusive, high-performance daily logging companion that feels identical to a native iOS application, respecting localized Arabic typographic nuances alongside universal metric and macro standards.

## Colors

The palette leverages restorative botanical greens, distinct macro-nutrient identifiers, and grounded slate neutrals to ensure split-second readability in bright daylight and low-light kitchen environments.

### Primary, Secondary & Macronutrient Roles
- **Primary Accent (Sage / Emerald - `#059669` / `#10B981`):** The primary brand voice. Used for completed goals, overall daily balance, primary calls to action, and authenticated state confirmations.
- **Protein Metric (Indigo / Iris - `#6366F1`):** A deep, focused purple-blue reserved exclusively for protein tallies, structural target rings, and muscle-synthesis indicators.
- **Carbohydrates Metric (Warm Amber - `#F59E0B`):** A luminous, warm hue indicating dietary energy, grain intake, and carbohydrate allocation.
- **Fats Metric (Rose Coral - `#F43F5E`):** A soft, distinct warm red-pink dedicated to lipid tracking, avoiding confusion with neutral states.

### Quality & Verification Status Badges
- **Verified (`✓`):** Tinted emerald surface (`#ECFDF5`) with solid emerald text/icon (`#059669`).
- **Estimated (`≈`):** Soft warm amber surface (`#FFFBEB`) with deep amber text/icon (`#D97706`).
- **Unmatched / Manual (`!`):** Muted cool slate surface (`#F1F5F9`) with slate-sky text/icon (`#475569`).

### Neutrals & Surfaces
- **Canvas Base:** `#F8FAFC` (Slate 50) for crisp native iOS screen separation.
- **Card & Container Base:** `#FFFFFF` (Pure White).
- **Secondary Surface:** `#F1F5F9` (Slate 100) for inset lists and segmented track backgrounds.
- **Text Tiers:** Primary `#0F172A` (Slate 900), Secondary `#475569` (Slate 600), Tertiary/Muted `#94A3B8` (Slate 400).
- **Dividers & Outlines:** `#E2E8F0` (Slate 200).

## Typography

Typography prioritizes Arabic reading rhythm while maintaining total parity with Latin numerals and symbols. **IBM Plex Sans** (with fallback to `system-ui`, `-apple-system`, and Tajawal) ensures balanced vertical metrics, crisp rendering on high-density iOS retina displays, and formal mechanical distinction for data logs.

### Typographic Directives
- **RTL Baseline Alignment:** Arabic diacritics and ascenders/descenders require an extra `10%` to `15%` line-height headroom compared to pure Latin text; body line heights must never drop below `1.4x`.
- **Numbers & Metrics:** Use tabular lining figures (`font-variant-numeric: tabular-nums`) across all nutritional breakdowns, macro grams, and caloric targets to prevent layout jitter during data updates.
- **Weight Pairing:** Body text stays strictly at `400` weight for fluid legibility, while section anchors and macros utilize `600` and `700` weights.

## Layout & Spacing

The design system operates on an uncompromising **4pt/8pt incremental grid rhythm**. 

### Viewport & Boundaries
- **PWA Constraint:** The layout is locked to a mobile canvas with a maximum container width of `448px` (`max-w-md`), centered with responsive canvas borders on desktop viewports.
- **Safe Area Insets:** All root screens respect iOS environment boundaries (`env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`), ensuring navigation chrome and tab bars clear native home indicators and dynamic islands.

### RTL Grid Flow
- Horizontal padding (`margin: 1rem / 16px`) runs symmetrically down both edges of the viewport.
- Flow Direction is strictly logical: `margin-inline-start`, `padding-inline-end`, and `inset-inline-*` govern all alignments to ensure seamless mirrored layout delivery for Right-to-Left script direction.

## Elevation & Depth

Visual hierarchy uses **iOS tonal layering** combined with delicate ambient shadows rather than stark elevation breaks.

### Surface Tiers
- **Layer 0 (Background Canvas):** Solid `#F8FAFC`.
- **Layer 1 (Card & Group Plinths):** Solid `#FFFFFF` elevated via a single ambient drop shadow: `0 2px 8px -2px rgba(15, 23, 42, 0.04), 0 1px 3px 0 rgba(15, 23, 42, 0.02)`.
- **Layer 2 (Floating Action Items & Sheets):** Elevated modal layers and bottom sheets use `0 12px 32px -4px rgba(15, 23, 42, 0.08)` paired with an ultra-fine border `1px solid rgba(226, 232, 240, 0.8)`.
- **Layer 3 (Glassmorphic Chrome):** The top navigation header and bottom tab bar utilize a translucent glass fill: `background: rgba(255, 255, 255, 0.82)` with `backdrop-filter: blur(20px) saturate(180%)` and a bottom/top border `rgba(226, 232, 240, 0.6)`.

## Shapes

The interface embraces organic, smooth iOS continuous curves (squircle aesthetics).

- **Primary Cards & Containers:** Standardized to `20px` (`rounded-2xl` / `1.25rem`), providing a tactile, pillowed surface for daily macro overviews and meal groups.
- **Interactive Controls (Inputs, Buttons, List Items):** Form fields and standard buttons use `12px` to `14px` radius for quick touch targets.
- **Segmented Selectors & Badges:** Use full pills (`rounded-full` / `9999px`) for macro tags, verification indicators, and toggle switch capsules.

## Components

### Buttons
- **Primary Action (Log Meal, Save):** Full-width or inline `44px` minimum height, background `#059669`, text `#FFFFFF`, font weight `600`, radius `12px`. Subtle active state scale (`active:scale-[0.98]`).
- **Secondary Action:** Background `#F1F5F9`, text `#0F172A`, radius `12px`.
- **Icon Buttons:** `40x40px` circular or rounded-lg tap area with `#64748B` glyph color.

### iOS Segmented Controls
- Background container styled in `#E2E8F0` with `2px` interior padding and `10px` radius.
- Active tab features a floating white thumb `#FFFFFF` with `8px` corner radius, cast with a tiny micro-shadow `0 1px 3px rgba(0,0,0,0.08)`.
- Smooth slide transitions between states; text switches between `#64748B` (inactive) and `#0F172A` (active, font-weight 600).

### Circular Progress Rings (Macros & Calories)
- SVG-based multi-ring or single-ring circular meters with rounded stroke caps (`stroke-linecap: round`).
- **Background Track:** Light neutral stroke `#F1F5F9`.
- **Foreground Bars:** Color-mapped strictly to nutrition tokens (Emerald for Total/Target, Indigo for Protein, Warm Amber for Carbs, Rose Coral for Fats).
- Center layout features tabular metric numerals stacked vertically over localized micro-labels.

### Cards & Inset Grouped Lists
- Cards use `#FFFFFF` with `20px` rounding and internal `16px` padding.
- Multi-item meal entries adopt the iOS inset grouped pattern: elements inside a card are separated by a hairline border (`#F1F5F9`) indented by `16px` from the leading inline edge.

### Status Badges (Data Confidence)
- Height: `22px`, pill-shaped (`rounded-full`), horizontal padding `8px`.
- Icon precedes text according to RTL alignment (`margin-inline-end: 4px`).
- **Verified:** Emerald tint with icon `✓`.
- **Estimated:** Amber tint with icon `≈`.
- **Unmatched:** Slate tint with icon `!`.

### Form Fields & Log Inputs
- Native input fields have a height of `48px`, background `#F8FAFC`, border `1px solid #E2E8F0`, corner radius `12px`, and clear typography aligned to the right by default (`text-align: right`).
- Metric unit labels (e.g., "غ" / "g", "سعرة" / "kcal") sit pinned to the inline end inside the field with muted slate styling.

### Bottom Navigation Bar
- Fixed bottom position inside `max-w-md` boundary, elevated using iOS glassmorphism (`82%` opacity white with `20px` blur).
- 4 to 5 navigation items evenly spaced along a flex row.
- Active item uses primary emerald `#059669` fill with subtle dot indicator underneath; inactive items remain `#94A3B8`.
- Elevated center action button ("Quick Log" `+`) with high-contrast emerald fill, soft ambient green glow, and floating elevation.