# Design System Strategy: The Clinical Precision Workbench

## 1. Overview & Creative North Star
**The Creative North Star: "The Observational Lens"**

This design system moves away from the generic "SaaS dashboard" and toward a high-end, editorialized workbench. The aesthetic is inspired by precision instruments, scientific journals, and clinical clarity. We are not just building an interface; we are building a digital environment that feels as calibrated as the equipment it manages.

To break the "template" look, we utilize **Intentional Asymmetry** and **Tonal Depth**. Large, expansive white space (the "Laboratory Floor") is juxtaposed with dense, data-rich modules ("The Instrumentation"). By utilizing editorial typography—specifically the contrast between the technical *Inter* and the architectural *Manrope*—we guide the eye through complex data with the authority of a peer-reviewed publication.

---

## 2. Colors: Tonal Depth & The "No-Line" Rule
The palette is rooted in a deep, authoritative teal, supported by high-chroma status indicators that cut through the clinical neutral base.

### Color Strategy
*   **Primary (`primary_container` #003d4d):** Reserved for high-level navigation and anchoring the user’s focus.
*   **Secondary (`secondary` #006b59):** Used exclusively for "Active/Optimal" states, mimicking the green "Ready" light on lab hardware.
*   **The "No-Line" Rule:** To achieve a premium look, **1px solid borders are prohibited for sectioning.** We do not draw boxes; we define space. Content boundaries must be created solely through background shifts. For example, a `surface_container_low` sidebar sitting against a `surface` background.
*   **Surface Hierarchy & Nesting:** Treat the UI as a physical stack of slides.
    *   **Base:** `surface` (#f8f9fa)
    *   **Low Importance:** `surface_container_low` (#f3f4f5)
    *   **Main Cards:** `surface_container_lowest` (#ffffff)
    *   **Elevated Details:** `surface_container_highest` (#e1e3e4)
*   **The Glass & Gradient Rule:** Use Glassmorphism (`surface_variant` at 60% opacity with 20px backdrop-blur) for floating overlays or modal headers. Apply a subtle linear gradient (from `primary` to `primary_container`) on primary CTAs to provide a tactile, "machined" finish.

---

## 3. Typography: The Editorial Scale
We use a dual-typeface system to balance readability with a signature "published" feel.

*   **Display & Headlines (Manrope):** This is our "Architectural" face. Use `display-lg` to `headline-sm` for page titles and high-level metrics. The wide aperture of Manrope feels modern and intentional.
*   **Body & Labels (Inter):** This is our "Technical" face. Inter is used for all data points, list items, and status labels (`body-md`, `label-sm`). It provides the density required for a professional workbench without sacrificing legibility.
*   **Hierarchy Tip:** Always pair a `headline-sm` in Manrope with a `label-md` in Inter (All Caps, 0.05em tracking) for card headers to create an authoritative, data-first hierarchy.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are often messy in dense dashboards. We use **Tonal Layering** to define priority.

*   **The Layering Principle:** Depth is achieved by "stacking." Place a `surface_container_lowest` (Pure White) card on a `surface_container_low` background. This creates a "natural lift" that feels clean and scientific.
*   **Ambient Shadows:** For floating elements (Modals, Popovers), use a shadow tinted with the `on_surface` color: `box-shadow: 0 12px 40px -10px rgba(25, 28, 29, 0.06)`. This mimics soft, overhead laboratory lighting.
*   **The Ghost Border:** If a boundary is required for accessibility (e.g., in a high-density data table), use a "Ghost Border": `outline_variant` at 15% opacity. It should be felt, not seen.

---

## 5. Components: Style Guidelines

### Buttons & Actions
*   **Primary:** `primary_container` background with `on_primary` text. Use `md` (0.375rem) roundedness.
*   **Secondary:** `surface_container_high` background. No border.
*   **The Signature Action:** For "Run Test" or "Confirm," use a gradient-filled button to differentiate it from standard navigation.

### Chips & Status Labels
*   **Success:** `secondary_container` background with `on_secondary_container` text.
*   **Warning (Low Stock):** `tertiary_fixed` background with `on_tertiary_fixed_variant` (Amber).
*   **Alert (Failure):** `error_container` background with `on_error_container` (Brick Red).
*   *Styling Note:* Chips should use `full` roundedness and `label-sm` typography for a "serialized" look.

### Input Fields
*   Use `surface_container_low` for the input background. Remove the bottom border in favor of a subtle 2px active-state indicator in `primary` only when focused.

### Cards & Data Lists
*   **Strict Rule:** No dividers. Use `spacing-lg` (vertical white space) or alternating tonal shifts between `surface_container_lowest` and `surface_container_low` to separate list items.
*   **Content:** Group related data using `label-sm` headers to create "Information Blocks."

### Additional Custom Components
*   **The "Telemetry Strip":** A thin, horizontal progress or health bar using `secondary` (success) or `error` (failure) at the very top of a card to show equipment status at a glance.
*   **The "Glass Drawer":** A side-panel for deep-dive metrics using a 70% opaque `surface` with a heavy backdrop blur, allowing the dashboard context to remain visible.

---

## 6. Do’s and Don’ts

### Do
*   **Do** prioritize "Information Density." Science is complex; don't be afraid of data, but organize it through strict typography levels.
*   **Do** use `primary_fixed` for subtle background highlights in selected states.
*   **Do** use asymmetrical layouts (e.g., a wide 8-column main view and a narrow 4-column "Live Feed" sidebar) to create visual interest.

### Don’t
*   **Don’t** use black (#000000). Use `on_surface` (#191c1d) for text to maintain a high-end, soft-contrast feel.
*   **Don’t** use icons without labels in the main navigation. In a professional tool, clarity beats "minimalist" ambiguity.
*   **Don’t** use standard shadows. If a card needs to pop, use a background color shift first.