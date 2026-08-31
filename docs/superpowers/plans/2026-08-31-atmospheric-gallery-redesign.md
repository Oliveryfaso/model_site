# Atmospheric Gallery Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a borderless, color-adaptive 3D exhibit stage, a wooden model plinth, high-resolution homepage covers, and the supplied opt-in background music while preserving existing routes and sharing behavior.

**Architecture:** Exhibit-owned palette metadata feeds a focused canvas atmosphere layer and CSS variables. React Three Fiber continues to own the model, lighting, camera, and plinth; React/CSS own the floating annotation and controls. A Playwright capture script produces static homepage covers from the real stage so the homepage stays fast.

**Tech Stack:** React 19, React Router 7, TypeScript, Vite, Three.js, React Three Fiber, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-31-atmospheric-gallery-redesign.md`

## Global Constraints

- Keep the existing framework and dependencies; add no new package.
- No autoplay: audio remains opt-in through the existing `SoundToggle` flow.
- Detail routes use `min-height: 100dvh` and hide the normal header/footer.
- Reduced motion freezes ambient motion and pointer tilt.
- Changes remain reviewable and targeted; this folder is not currently a Git repository, so do not create commits.

---

### Task 1: Exhibit palette contract and atmosphere model

**Files:**
- Modify: `src/content/types.ts`
- Modify: `src/content/exhibits.ts`
- Modify: `src/content/validateExhibits.ts`
- Test: `src/content/validateExhibits.test.ts`
- Create: `src/exhibit/atmosphere.ts`
- Test: `src/exhibit/atmosphere.test.ts`

**Interfaces:**
- Produces: `Exhibit.presentation.palette: readonly [string, string, string]`
- Produces: `resolveAtmospherePalette(exhibit): { base: string; shadow: string; primary: string; accent: string }`

- [ ] Write a failing validation test proving a missing/invalid three-color palette is rejected and a valid tuple passes.
- [ ] Run `npm test -- src/content/validateExhibits.test.ts` and verify the failure names the missing contract.
- [ ] Add the tuple type, current exhibit palettes, and validation with literal hex matching.
- [ ] Write a failing `atmosphere.test.ts` proving the helper returns the exhibit tuple without hard-coded cyan.
- [ ] Implement the pure palette helper and run both tests green.

### Task 2: Dynamic edge-bloom background

**Files:**
- Create: `src/exhibit/AtmosphereBackground.tsx`
- Create: `src/exhibit/AtmosphereBackground.test.tsx`
- Modify: `src/exhibit/ModelExperience.tsx`
- Modify: `src/exhibit/SceneEnvironment.tsx`
- Modify: `src/exhibit/ModelScene.tsx`
- Modify: `src/styles/exhibit.css`

**Interfaces:**
- Consumes: `presentation.palette`
- Produces: `<AtmosphereBackground palette={palette} motion="edge-bloom" />`

- [ ] Write a failing component test asserting the atmosphere canvas exposes all three colors as CSS custom properties and is decorative.
- [ ] Run the focused test and verify it fails because the component does not exist.
- [ ] Implement a DPR-capped 2D canvas with slow sine-drift vertical folds, screen blending, lower-right radial bloom, ResizeObserver cleanup, and reduced-motion freeze.
- [ ] Make the WebGL canvas transparent, preserve fog, and layer the atmosphere below the model.
- [ ] Run focused tests and the existing model lifecycle tests.

### Task 3: Wooden plinth and pointer-follow model interaction

**Files:**
- Create: `src/exhibit/DisplayPlinth.tsx`
- Modify: `src/exhibit/ModelScene.tsx`
- Test: `src/exhibit/ModelExperience.test.tsx`
- Test: `src/exhibit/sceneProfiles.test.ts`

**Interfaces:**
- Produces: `placeOwnedSceneOnPlinth(scene, topY): Object3D`
- Produces: `resolvePointerTilt(pointer, reducedMotion): [number, number]`

- [ ] Write failing pure-behavior tests proving a model's final bounding-box minimum rests at the plinth top and reduced motion returns zero tilt.
- [ ] Run focused tests and confirm the expected failures.
- [ ] Add a walnut cylinder plinth with edge rings and a receiving shadow; place every normalized model on its top.
- [ ] Wrap the model in a damped pointer-tilt group while keeping OrbitControls drag, pan, zoom, and reset.
- [ ] Run model and scene-profile tests green.

### Task 4: Borderless stage and breathing annotation

**Files:**
- Modify: `src/app/AppShell.tsx`
- Modify: `src/exhibit/ExhibitPage.tsx`
- Modify: `src/exhibit/ExhibitLayout.tsx`
- Modify: `src/exhibit/ExhibitToolbar.tsx`
- Modify: `src/styles/global.css`
- Replace targeted rules in: `src/styles/exhibit.css`
- Test: `src/exhibit/ExhibitPage.test.tsx`
- Test: `src/exhibit/ExhibitToolbar.test.tsx`

**Interfaces:**
- Produces: route class `site-frame--exhibit`
- Produces: accessible disclosure button labelled `查看藏品说明` on compact viewports

- [ ] Write failing tests proving exhibit routes use the borderless shell, retain back/share/sound/reset controls, and render an accessible information disclosure.
- [ ] Run the focused tests and confirm failures are caused by the old shell/layout.
- [ ] Hide global chrome on exhibit routes, make the stage full viewport, move controls to quiet floating clusters, and remove viewer borders and card surfaces.
- [ ] Implement the C annotation: title visible; copy opacity/scale responds to hover and focus; mobile disclosure opens without covering the whole model.
- [ ] Fix the ready-cover bug by making a ready cover non-interactive, hidden, and removed from layout paint.
- [ ] Run exhibit tests green.

### Task 5: Supplied music and restrained volume

**Files:**
- Copy: `esmifiesta - Felicia Morales - Merry Christmas Mr Lawrence.mp3` → `public/audio/merry-christmas-mr-lawrence.mp3`
- Modify: `src/app/siteConfig.ts`
- Modify: `src/audio/AudioDirector.ts`
- Modify: `src/audio/AudioDirector.test.ts`
- Modify: `src/audio/AudioIntegration.test.tsx`

**Interfaces:**
- Produces: `siteConfig.themeTrack === "/audio/merry-christmas-mr-lawrence.mp3"`
- Produces: collection theme target `0.3`, reduced exhibit theme target `0.16`
- Produces: ambient exhibit mix target `0.45` with theme bed `0.12`

- [ ] Update tests first to expect the supplied MP3 and restrained theme volumes; run them and verify red.
- [ ] Copy the user-provided audio, update configuration, and centralize collection, exhibit-bed, and ambience target volume constants.
- [ ] Run all audio tests green and verify the build asset validator accepts the MP3.

### Task 6: High-resolution static covers and homepage polish

**Files:**
- Create: `scripts/capture-model-covers.ts`
- Modify: `package.json`
- Modify: `src/home/FeaturedExhibit.tsx`
- Modify: `src/home/ExhibitCard.tsx`
- Modify: `src/styles/home.css`
- Replace generated: `public/covers/avocado.jpg`
- Replace generated: `public/covers/antique-camera.jpg`
- Replace generated: `public/covers/fox.jpg`
- Test: `src/home/CollectionPage.test.tsx`

**Interfaces:**
- Produces: `npm run covers:capture`
- Produces: 1600×1200 JPEG covers captured from `[data-cover-capture]`

- [ ] Write a failing homepage test proving exhibit links opt into router view transitions and cover images declare explicit dimensions/lazy-loading where appropriate.
- [ ] Update home components and CSS so images feel like plinth portraits rather than bordered cards.
- [ ] Add React Router view-transition opt-in and matching `view-transition-name` values so the selected cover expands continuously into the exhibit stage; use a spring-like `cubic-bezier(.22,1,.36,1)` and reduced-motion fallback.
- [ ] Add a Playwright capture script that opens each exhibit with `?capture=cover`, waits for `data-model-state="ready"`, and screenshots the capture target at 1600×1200.
- [ ] Run the script, inspect all three generated images, and confirm they exceed the old source dimensions.
- [ ] Run the homepage test and asset-budget check.

### Task 7: Global refinement and end-to-end verification

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/global.css`
- Modify: `index.html`
- Modify: `tests/e2e/gallery.spec.ts`

**Interfaces:**
- Consumes all previous tasks; produces no new public API.

- [ ] Add failing e2e assertions for a borderless viewer, mobile non-obstruction, model drag affordance, sound opt-in, and back navigation.
- [ ] Refine warm-gray tokens, optical spacing, press states, focus states, grain, metadata, theme color, and social description without renaming the site.
- [ ] Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`.
- [ ] Render desktop 1440×900 and mobile 390×844 screenshots for homepage and `green-core`; inspect overflow, cover removal, text obstruction, background restraint, and controls.
- [ ] Run `git diff --check` only if a Git repository has been initialized; otherwise inspect changed files and build output directly.

### Task 8: Blender/GLB intake contract and next-session handoff

**Files:**
- Create: `docs/model-pipeline.md`
- Create: `docs/blender-session-prompt.md`
- Create: `incoming/example/exhibit.json`
- Create: `incoming/README.md`
- Create: `workfiles/README.md`
- Create: `scripts/validate-model-package.mjs`
- Modify: `package.json`
- Test: `scripts/validate-model-package.test.mjs`

**Interfaces:**
- Consumes: `incoming/<slug>/<slug>.glb`, `incoming/<slug>/preview.jpg`, `incoming/<slug>/exhibit.json`
- Produces: `npm run models:validate -- incoming/<slug>`
- Keeps editable Blender sources outside deployment at `workfiles/<slug>/`

- [ ] Write failing validator tests for the package layout, required metadata, exactly three palette colors, self-contained GLB naming, preview dimensions, standard/hero budgets, and optional animation clip names.
- [ ] Implement the package validator without adding a runtime dependency; make diagnostics actionable and non-destructive.
- [ ] Document coordinates, origin and scale, wooden-plinth contact, supported PBR maps, texture color spaces and sizes, triangle/file budgets, animation naming, palette suggestion/override, and website safety-normalization.
- [ ] Write a complete Chinese copy-paste startup prompt for the separate Blender session, limiting it to `incoming/<slug>/` and `workfiles/<slug>/` and requiring the validation report.
- [ ] Run the validator unit tests and a sample-package dry run; confirm the application build still passes.
