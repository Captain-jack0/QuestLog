---
name: Celestial Cartographer
colors:
  surface: '#07112f'
  surface-dim: '#07112f'
  surface-bright: '#2f3857'
  surface-container-lowest: '#030c2a'
  surface-container-low: '#101a38'
  surface-container: '#151e3c'
  surface-container-high: '#1f2847'
  surface-container-highest: '#2a3353'
  on-surface: '#dce1ff'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#dce1ff'
  inverse-on-surface: '#262f4e'
  outline: '#8c909f'
  outline-variant: '#424753'
  surface-tint: '#aec6ff'
  primary: '#aec6ff'
  on-primary: '#002e6a'
  primary-container: '#4e8eff'
  on-primary-container: '#00275d'
  inverse-primary: '#005ac3'
  secondary: '#ffb872'
  on-secondary: '#4a2800'
  secondary-container: '#ab6302'
  on-secondary-container: '#fffbff'
  tertiary: '#4bdfa1'
  on-tertiary: '#003824'
  tertiary-container: '#00a571'
  on-tertiary-container: '#00311e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#aec6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#ffdcbf'
  secondary-fixed-dim: '#ffb872'
  on-secondary-fixed: '#2d1600'
  on-secondary-fixed-variant: '#6a3b00'
  tertiary-fixed: '#6cfcbb'
  tertiary-fixed-dim: '#4bdfa1'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#07112f'
  on-background: '#dce1ff'
  surface-variant: '#2a3353'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 52px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 38px
    letterSpacing: -0.025em
  display-sm:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  title-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
    letterSpacing: -0.015em
  title-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  lead:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
    letterSpacing: -0.005em
  lead-mobile:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-default:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-medium:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  micro:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  tabular-timer:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
  tabular-xp:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2.5rem
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
  nav-bar-height: 4.25rem
  timer-stack-height: 3.5rem
---

## Brand & Style

This design system approaches gamification through an editorial, celestial lens rather than a juvenile arcade metaphor. It is built for disciplined dreamers, polymaths, and knowledge workers orchestrating life facets across careers, side projects, creative endeavors, and home life. The aesthetic fuses **tactile sci-fi cartography** with **calm productivity minimalism**.

The interface treats personal ambition not as a frantic checklist, but as an unfolding cosmic expedition. Interactions prioritize high-agency focus: fluid timers, decisive status progression, tactile card edges indicating life realms, and luminous rewards for momentum.

The design system operates across two visual modes:
- **Quest (Dark - Default):** An atmospheric nocturnal sky field dotted with CSS-rendered micro-stars, deep indigo spatial tiers, and self-luminous neon indicators.
- **Calm (Light):** A tactile, daylight cream parchment evoking expedition journals, architectural drafting desks, and serene morning review sessions.

## Colors

The color architecture is built around semantic dual-theming and life-domain demarcation.

### Dual-Palette Matrix
- **Quest Mode (Night Sky Spatial):** The default operational environment. Built with deeply saturated lapis-slate backgrounds (`#081230`), inset container planes (`#111F47`), and star-luminescent ink (`#E8EEFF`). The primary dynamic blue accent (`#4C8DFF`) anchors focus, while the flame orange (`#FFA84C`) designates streaks and burning stamina.
- **Calm Mode (Solar Studio):** Daylit mode engineered on high-CRI natural paper (`#FAFAF7`) and pure optical white card tiles (`#FFFFFF`). Text drops down to charcoal slate (`#1F2933`), shifting visual emphasis to soft ink lines and structural borders.

### Life Domain Spectrum (Area Edge Strips & Indicators)
Eight dedicated pastel spectral tokens represent the taxonomy of whole-life domains. These colors must only be applied to card indicator bars (4px vertical edge strips), area filter pips (6px solid spheres), and tag counter labels:
- **Systems & Dev:** `#56D4DD` (Cyan)
- **Work & Career:** `#79C0FF` (Sky Blue)
- **Growth & Learning:** `#7EE787` (Mint)
- **Vitality & Health:** `#FFA657` (Peach Amber)
- **Scholar & Reading:** `#D2A8FF` (Lavender)
- **Homestead & Family:** `#F2CC60` (Sun Gold)
- **Craft & Side Projects:** `#FF7EB6` (Blush)
- **Expression & Art:** `#F778BA` (Rose)

Never tint full card backgrounds with these hues; use them exclusively as precision orientation vectors against the surface containers.

## Typography

The type system is powered entirely by **Inter**, configured with strict OpenType variable features to satisfy precision gaming metrics, timers, and editorial scan paths.

### Tabular Numbers & Monospace Emulation
All active timers, elapsed durations, XP counters, and streak meters must activate OpenType feature settings: `'tnum' on` (tabular numbers) and `'zero' on` (slashed zero). This prevents layout shifts during sub-second or minute tick updates.

### Type Rules
- **Display & Titles:** Tightly tracked headings (`-0.015em` to `-0.03em`) create solid typographic gravity in mobile viewports.
- **Labels & Micro-Tokens:** Set in uppercase or small-caps with generous tracking (`0.04em`) to maintain legibility when rendered as sub-indicators within timer tracks and pill badges.
- **Content Hierarchy:** Always pair `micro` area tags directly above `title-md` quest names to establish parent-child categorization at a glance.

## Layout & Spacing

The layout is architected **mobile-first**, native to a **390px reference screen width** (standard contemporary hand frame), dynamically scaling upward to dual-column tablet views and a left-rail desktop structure.

### Viewport Structures
- **Mobile (< 768px):** Single column fluid container locked to safe areas. Standard screen margin is `1rem` (16px). All primary thumb targets sit within a dynamic bottom tier: the fixed 68px (4.25rem) 5-tab bar, topped by the expandable 56px (3.5rem) floating multi-timer bar. Total bottom safe-padding offset is `8rem` so card contents never sit under interactive bars.
- **Tablet (768px – 1024px):** 2-column masonry grid for quests. Navigation migrates to an icon-labeled sidebar.
- **Desktop (≥ 1024px):** Fixed 260px spatial side rail navigation. Content switches to an asymmetric split: a primary 8-column workspace containing the active lane and quick-capture deck, flanked by a 4-column contextual panel for the celestial radar, streak stats, and master project timers.

### Rhythm & Alignment
Component padding strictly uses `space-sm` (8px) for badges/tags, `space-md` (16px) for interior card boxes, and `space-lg` (24px) for master quest section splits.

## Elevation & Depth

Visual hierarchy does not rely on heavy drop shadows. Depth is communicated through **ambient luminescence**, **lapis-tinted tonal layering**, and **tactile structural hairline borders**.

### Atmospheric Starfield Surface
The canvas background in Quest mode features an organic, double-layered pseudo-element CSS radial particle starfield (dots varying between 1px and 2px, opacities 0.2 to 0.7) set atop `#081230`.

### Tonal Hierarchy
- **Canvas / Paper (`#081230` / `#FAFAF7`):** The zero-elevation bedrock plane.
- **Cards & Plates (`#111F47` / `#FFFFFF`):** Elevation 1. Outlined with a 1px solid hairline (`#203368` in dark, `#E9E9E4` in light). 
- **Floating Decks & Modals (`#1A2C63` / `#FFFFFF`):** Elevation 2. Paired with a soft ambient aura: `0 8px 32px -4px rgba(8, 18, 48, 0.65)` in Quest mode, and `0 12px 32px -6px rgba(31, 41, 51, 0.08)` in Calm mode.
- **Active / Running Elements:** Highlighted with a luminous outer halo: `0 0 16px rgba(76, 141, 255, 0.35)`.
- **Streak Flame Focus:** Surrounded by an ember glow: `0 0 14px rgba(255, 168, 76, 0.4)`.

## Shapes

The interface adopts a calibrated modern curvature (**Level 2: Rounded**) providing ergonomic comfort for rapid thumb tap targets without sacrificing data density:
- **Default Elements:** `0.5rem` (8px) for buttons, inputs, status pills, and list-row selectors.
- **Cards & Surfaces:** `rounded-lg` at `1rem` (16px) for quest containers, dashboard modules, and bottom sheet dialogs.
- **Overlays & Drawers:** `rounded-xl` at `1.5rem` (24px) for top-edge mobile drawers and celebratory modal sheets.
- **Full Pills (`rounded-full`):** Reserved strictly for area dots, numeric XP badges, avatar rings, and floating tab triggers.

## Components

### 1. Resume-First Quest Card
- **Structure:** 16px rounded surface with a vertical 4px color strip flush along the left outer edge, keyed to the life area token.
- **Header:** Area pip (6px circle) and uppercase category label (`micro`) on the top-left; Status Chip on the top-right.
- **Body:** Quest Title (`title-md` or `lead`), accompanied by last active metadata ("Worked on 2h ago") in `caption` muted text.
- **Action Strip:** Prominent "Resume" primary micro-button positioned adjacent to the project's cumulative tabular time token.
- **Card States:** Resting cards display subtle borders (`line`); cards with an active running timer transition border color to `accent` with a pulse glow.

### 2. Status Chips
- **Idea:** Transparent background, `muted` text, 1px dashed `line` border.
- **Planned:** Translucent surface tint, `muted` text, 1px solid `line` border.
- **In Progress:** Solid `accent` background (`#4C8DFF` Quest / `#2F4FB5` Calm), crisp high-contrast white text, subtle glowing shadow.
- **Paused:** Surface elevated background, amber dot indicator, `ink` text.
- **Blocked:** Subtle alert tint background (`alert` at 15% opacity), `#FF6B81` text, exclamation glyph prefix.
- **Done:** Success tint background (`success` at 15% opacity), `#3ED598` text, checkmark glyph.
- **Dropped:** Surface backdrop, text rendered in `muted` with strike-through (`line-through`), border opacity dimmed to 40%.

### 3. Stacked Bottom TimerBar (Mobile Anchor)
- **Positioning:** Fixed directly above the 390px bottom navigation bar (`bottom: 4.25rem`).
- **Capacity:** Manages up to three concurrent tracked clocks in a unified horizontal slab:
  1. **Project Total:** Cumulative duration (`tabular-timer`).
  2. **Task Session:** Current work sprint duration.
  3. **Pomodoro Phase (🍅):** Visual segmented arc pill displaying focus/break cycles (25m/5m default).
- **Controls:** Micro play/pause icon, skip step button, and expand chevron to expose notes.

### 4. Bottom Navigation Tab Bar (390px Mobile Native)
- Height: 68px (`nav-bar-height`) with blurred backdrop (`backdrop-filter: blur(16px)`).
- Five ergonomic thumb slots:
  1. **Log (Quests / Current)**
  2. **Radar (Areas / Matrix)**
  3. **Quick (+ Floating Action Capsule)**
  4. **Flame (Streaks / Momentum)**
  5. **Vault (Review / Stats)**
- Active tab indicates state through a luminous dot beneath the icon and an `accent` icon fill.

### 5. Celebratory XP Toast & Streak Flame
- **XP Toast:** Floats from top-center on micro-quest completion. Deep lapis pill encased in an energetic border, displaying "+45 XP" in `tabular-xp` gold with an ascending celestial flare animation.
- **Streak Flame Indicator:** Compact badge containing a dynamic flame icon (`flame` `#FFA84C`), current day count in bold tabular format, and a perimeter ring illustrating day-completion fraction.

### 6. Buttons & Inputs
- **Primary Buttons:** High-energy fill (`accent`), bold font, 44px min-height hit target on mobile.
- **Secondary Buttons:** Inset surface (`surface_elevated`), 1px `line` boundary, `ink` font.
- **Input Fields:** Flush dark ink plates with recessed inner shadow, placeholder text in `muted`, transitioning to an `accent` border highlight on focus.