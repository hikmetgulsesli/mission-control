```markdown
# Design System Document

## 1. Overview & Creative North Star: "The Analytical Atelier"

This design system is built to transform the sterile environment of Product Requirements Document (PRD) testing into a high-end, editorial experience. We reject the "standard SaaS" look of heavy borders and cluttered grids. Instead, we follow the **Analytical Atelier** North Star: a workspace that feels as precise as a laboratory but as curated as a design studio.

The system breaks the "template" aesthetic through **intentional asymmetry** and **tonal depth**. By utilizing extreme typographic contrast (oversized Manrope headlines against tight Inter labels) and replacing structural lines with background shifts, we create a UI that feels architectural and "carved" rather than "assembled."

---

## 2. Colors & Tonal Architecture

Our palette is rooted in a sophisticated neutral base (`#f7f9fb`) punctuated by high-performance "Action Blue" (`#0053dc`).

### The "No-Line" Rule
To achieve a premium feel, **1px solid borders for sectioning are strictly prohibited.** Do not use `outline` or `outline-variant` to separate the sidebar from the main content or to define header boundaries. Boundaries must be defined solely through:
- **Background Shifts:** Use `surface-container-low` for secondary navigation areas sitting on a `surface` background.
- **Tonal Transitions:** Use `surface-dim` for footers or utility bars to create a grounded weight without a hard line.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of fine paper. 
- **Base Layer:** `surface` (#f7f9fb)
- **Secondary Workspace:** `surface-container-low` (#f0f4f7)
- **Primary Content Cards:** `surface-container-lowest` (#ffffff)
- **Interactive Modals:** `surface-bright` (#f7f9fb)

### The "Glass & Gradient" Rule
For floating elements (popovers, dropdowns), use **Glassmorphism**. Apply `surface-container-lowest` at 80% opacity with a `20px` backdrop-blur. 
**Signature Textures:** For main CTAs and Hero headers, use a subtle linear gradient transitioning from `primary` (#0053dc) to `primary_container` (#3e76fe) at a 135-degree angle. This adds "visual soul" and prevents the blue from looking like a default system color.

---

## 3. Typography: Editorial Authority

We use a dual-font strategy to balance technical precision with high-end aesthetic.

*   **Display & Headlines (Manrope):** This is our "Editorial" voice. Use `display-lg` (3.5rem) for dashboard welcomes or empty states. The wide apertures of Manrope convey modernity and openness.
*   **Body & UI (Inter):** This is our "Functional" voice. Inter is used for PRD text, test cases, and inputs to ensure maximum legibility at small sizes (`body-sm`: 0.75rem).

**Hierarchy Principle:** Use `on_surface_variant` (#596064) for labels to create a soft contrast against `on_surface` (#2c3437) headlines. This "muted-to-sharp" transition guides the eye naturally through complex documentation.

---

## 4. Elevation & Depth: Tonal Layering

We convey hierarchy through **Tonal Layering** rather than traditional structural lines or heavy drop shadows.

*   **The Layering Principle:** Depth is achieved by "stacking." Place a `surface-container-lowest` card on a `surface-container-low` section. This creates a soft, natural lift that feels integrated into the environment.
*   **Ambient Shadows:** If a "floating" effect is required (e.g., a draggable test case), use a shadow with a 40px blur at 6% opacity. The shadow color must be a tinted version of `on_surface` (a deep cool grey) rather than pure black.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility in data-heavy tables, use `outline-variant` at **15% opacity**. Never use a 100% opaque border.
*   **Interactive Glass:** Use semi-transparent `surface_tint` (#0053dc) at 5% opacity for hover states on white cards to create a "tinted glass" glow.

---

## 5. Components: The Building Blocks

### Buttons
*   **Primary:** Gradient of `primary` to `primary_container`. Radius: `md` (0.375rem). Text: `label-md` in `on_primary_fixed`.
*   **Secondary:** `secondary_container` background with `on_secondary_container` text. No border.
*   **Tertiary:** Ghost style. No background. Use `primary` text. Use for low-emphasis actions like "Cancel."

### Input Fields
*   **Base:** Background `surface_container_lowest`. 
*   **Border:** Use the "Ghost Border" (outline-variant at 20%). On focus, transition the border to `primary` at 100% and add a 4px "halo" of `primary` at 10% opacity.
*   **Layout:** Labels should be `label-sm` in `on_surface_variant`, positioned 0.5rem (Spacing 2) above the input.

### Cards & PRD Modules
*   **Forbid Divider Lines:** Use vertical white space (`spacing-8` or `spacing-10`) to separate content blocks. 
*   **Testing Status Chips:** Use `tertiary_container` for "Passing" and `error_container` for "Failing." Chips should have a `full` (9999px) radius and use `label-sm` typography.

### Contextual Components for PRD Testing
*   **The "Traceability Rail":** A thin, vertical strip using `surface-container-high` that connects related requirements.
*   **Annotation Callouts:** Use `tertiary_fixed_dim` with a 20% opacity background to highlight specific text strings within a PRD without obscuring readability.

---

## 6. Do's and Don'ts

### Do:
*   **Do** use asymmetrical margins (e.g., 6rem on the left, 4rem on the right) for hero sections to create an editorial feel.
*   **Do** use `spacing-12` (3rem) and `spacing-16` (4rem) to allow complex technical data to "breathe."
*   **Do** use `primary_dim` (#0049c2) for active states to provide a tactile "pressed" feel.

### Don't:
*   **Don't** use pure black (#000000) for text. Always use `on_surface` (#2c3437) to maintain a sophisticated, ink-on-paper look.
*   **Don't** use standard 1px grey dividers between list items. Use a `1px` height `surface-container-highest` bar that stops 24px before the container edge.
*   **Don't** use sharp corners. Always use at least `sm` (0.125rem) for a subtle "softening" of technical data.

---

## 7. Spacing & Rhythm

All layouts must follow the defined spacing scale to maintain mathematical harmony.
- **Section Padding:** `spacing-16` (4rem) or `spacing-24` (6rem).
- **Component Gaps:** `spacing-4` (1rem) for related items; `spacing-8` (2rem) for unrelated items.
- **In-line Icons:** Always use a `spacing-2` (0.5rem) gap between an icon and its text label.

*Director's Final Note: Precision is not the absence of design; it is the presence of intentionality. Every pixel in this system must serve the user's focus.*```