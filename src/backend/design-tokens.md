# PCS Design Token Reference

Use this document to recreate the UI in Figma or any design tool.

---

## 🎨 Colors (HSL)

### Core
| Token | HSL | Hex (approx) | Usage |
|-------|-----|---------------|-------|
| Background | `hsl(0, 0%, 96%)` | #F5F5F5 | Page background |
| Foreground | `hsl(0, 0%, 9%)` | #171717 | Primary text |
| Card | `hsl(0, 0%, 98%)` | #FAFAFA | Card surfaces |
| Card Foreground | `hsl(0, 0%, 9%)` | #171717 | Card text |

### Brand / Primary
| Token | HSL | Hex (approx) | Usage |
|-------|-----|---------------|-------|
| Primary | `hsl(161, 93%, 30%)` | #05934B | Buttons, links, accents |
| Primary Foreground | `hsl(151, 80%, 95%)` | #E6FAF0 | Text on primary |
| Primary Light | `hsl(185, 70%, 45%)` | #228DA6 | Hover states, highlights |
| Primary Glow | `hsl(185, 85%, 55%)` | #2BB8D4 | Glows, decorative accents |

### Secondary & Muted
| Token | HSL | Hex (approx) | Usage |
|-------|-----|---------------|-------|
| Secondary | `hsl(0, 0%, 32%)` | #525252 | Secondary buttons |
| Secondary Foreground | `hsl(0, 0%, 98%)` | #FAFAFA | Text on secondary |
| Muted | `hsl(0, 0%, 63%)` | #A1A1A1 | Disabled, placeholder |
| Muted Foreground | `hsl(0, 0%, 9%)` | #171717 | Muted text |

### Accent
| Token | HSL | Hex (approx) | Usage |
|-------|-----|---------------|-------|
| Accent | `hsl(166, 76%, 96%)` | #E6FAF5 | Accent backgrounds |
| Accent Foreground | `hsl(173, 80%, 40%)` | #148C78 | Accent text/icons |

### Status
| Token | HSL | Hex (approx) | Usage |
|-------|-----|---------------|-------|
| Success | `hsl(145, 65%, 45%)` | #28A745 | Success states |
| Warning | `hsl(40, 95%, 50%)` | #F5A623 | Warning states |
| Destructive | `hsl(0, 72%, 50%)` | #DC3545 | Errors, delete actions |

### Border & Input
| Token | HSL | Hex (approx) | Usage |
|-------|-----|---------------|-------|
| Border | `hsl(0, 0%, 83%)` | #D4D4D4 | Borders |
| Input | `hsl(0, 0%, 83%)` | #D4D4D4 | Input borders |
| Ring | `hsl(161, 93%, 30%)` | #05934B | Focus rings |

### Sidebar
| Token | HSL | Hex (approx) | Usage |
|-------|-----|---------------|-------|
| Sidebar BG | `hsl(185, 70%, 25%)` | #134E5A | Sidebar background |
| Sidebar Foreground | `hsl(0, 0%, 9%)` | #171717 | Sidebar text |
| Sidebar Primary | `hsl(161, 93%, 30%)` | #05934B | Active sidebar item |

### Charts
| Token | HSL | Usage |
|-------|-----|-------|
| Chart 1 | `hsl(158, 64%, 51%)` | Primary chart color |
| Chart 2 | `hsl(141, 69%, 58%)` | Secondary chart color |
| Chart 3 | `hsl(172, 66%, 50%)` | Tertiary chart color |
| Chart 4 | `hsl(82, 77%, 55%)` | Quaternary chart color |
| Chart 5 | `hsl(0, 0%, 45%)` | Neutral chart color |

---

## 🔤 Typography

### Font Families
| Role | Font | Fallbacks |
|------|------|-----------|
| Sans (Body/UI) | **Work Sans** | system-ui, -apple-system, sans-serif |
| Serif (Display) | **Lora** | Georgia, Cambria, serif |
| Mono (Code) | **Inconsolata** | SFMono-Regular, Menlo, monospace |

### Font Weights
| Weight | Value | Usage |
|--------|-------|-------|
| Light | 300 | Subtle text |
| Regular | 400 | Body text |
| Medium | 500 | Labels, buttons |
| Semibold | 600 | Headings, emphasis |
| Bold | 700 | Strong emphasis |

### Heading Style
- **Weight:** 600 (Semibold)
- **Letter Spacing:** -0.02em
- **Font:** Work Sans

---

## 📐 Spacing & Layout

### Border Radius
| Token | Value |
|-------|-------|
| Large | 0.75rem (12px) |
| Medium | 0.625rem (10px) |
| Small | 0.5rem (8px) |

### Container
- **Max Width:** 1400px (2xl breakpoint)
- **Padding:** 2rem (32px)
- **Centered:** Yes

### Base Spacing Unit
- **--spacing:** 0.25rem (4px)

---

## 🌊 Gradients

| Name | Value |
|------|-------|
| Primary Gradient | `linear-gradient(135deg, hsl(185 75% 35%), hsl(185 85% 45%))` |
| Accent Gradient | `linear-gradient(135deg, hsl(185 75% 35%), hsl(25 95% 55%))` |

---

## 🔲 Shadows

| Token | Value |
|-------|-------|
| 2XS | `0 1px 3px 0px rgba(0,0,0,0.05)` |
| XS | `0 1px 3px 0px rgba(0,0,0,0.05)` |
| SM | `0 1px 3px rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)` |
| MD | `0 1px 3px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.1)` |
| LG | `0 1px 3px rgba(0,0,0,0.1), 0 4px 6px -1px rgba(0,0,0,0.1)` |
| XL | `0 1px 3px rgba(0,0,0,0.1), 0 8px 10px -1px rgba(0,0,0,0.1)` |
| 2XL | `0 1px 3px 0px rgba(0,0,0,0.25)` |
| Soft | `0 2px 8px -2px rgba(20,25,35,0.08)` |
| Medium | `0 4px 16px -4px rgba(20,25,35,0.12)` |

---

## ⚡ Transitions

| Name | Value |
|------|-------|
| Smooth | `all 0.3s cubic-bezier(0.4, 0, 0.2, 1)` |

---

## 🌙 Dark Mode Overrides

| Token | Dark Value (HSL) |
|-------|------------------|
| Background | `hsl(0, 0%, 9%)` |
| Foreground | `hsl(0, 0%, 98%)` |
| Card | `hsl(0, 0%, 14%)` |
| Primary | `hsl(158, 64%, 51%)` |
| Primary FG | `hsl(165, 91%, 9%)` |
| Border | `hsl(0, 0%, 32%)` |
| Accent | `hsl(178, 84%, 10%)` |
| Accent FG | `hsl(172, 66%, 50%)` |
| Radius | 0rem |

---

## 📝 Notes for Figma

1. **Create color styles** for each token above
2. **Create text styles** for Work Sans at weights 400/500/600/700
3. **Use 4px grid** (base spacing unit)
4. **Component radius:** 12px default
5. **No Lovable branding** — this is a standalone PCS design system
