# Digital Figure Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public static digital-figurine gallery with an editorial collection homepage, configurable interactive GLB exhibit pages, opt-in sound, graceful fallbacks, and exhibit-specific share links and preview cards.

**Architecture:** A Vite-built React and TypeScript application owns routing, UI, and global audio state. React Three Fiber owns reusable 3D layout and scene profiles. A project-owned post-build generator copies the built app shell into physical route directories and injects unique Open Graph metadata for each exhibit.

**Tech Stack:** Vite, React, TypeScript, React Router, Three.js, React Three Fiber, Drei, Vitest, Testing Library, Playwright

**Spec:** `docs/superpowers/specs/2026-08-30-digital-figure-gallery-design.md`

## Global Constraints

- The public brand name is deliberately unset; read `siteTitle` from configuration and never hard-code a temporary brand into UI components.
- Runtime content supports GLB only. Conversion from Blend, FBX, OBJ, or other formats remains outside the application.
- The production result is static output with physical `index.html` files for `/`, `/about/`, and every `/exhibits/:slug/` route.
- No database, runtime backend, authentication, upload interface, CMS, search, filtering, comments, favorites, downloads, VR, AR, or material editor.
- Homepage cards use cover images and never instantiate a Three.js canvas.
- First-visit audio is muted and cannot begin until an explicit visitor action.
- Unknown routes, missing models, unavailable WebGL, and empty catalogs remain readable and shareable.
- Target budgets: GLB 15 MB, warning above 25 MB; homepage cover 300 KB; share image approximately 1200×630; exhibit ambience approximately 3 MB.
- Preserve optional attribution fields but do not render them in the exhibit UI. Include required third-party notices with bundled sample assets.
- Do not commit or push unless the user gives explicit authorization. Each task ends with a review checkpoint instead of a Git commit.
- Before implementing visual components, load the installed `frontend-design` skill. Before browser automation, load the installed `playwright` skill.

---

## File and Responsibility Map

```text
digital-figure-gallery/
├── index.html                         Vite shell and metadata injection markers
├── package.json                       Commands and dependencies
├── playwright.config.ts               Browser-test configuration
├── tsconfig.json                      TypeScript project references
├── tsconfig.app.json                  Browser source configuration
├── tsconfig.node.json                 Vite and script configuration
├── vite.config.ts                     Vite and Vitest configuration
├── .env.example                       Required PUBLIC_ORIGIN example
├── public/
│   ├── audio/collection-theme.wav     Generated copyright-free demo theme
│   ├── audio/fox-ambient.wav          Generated copyright-free demo ambience
│   ├── covers/                        Lightweight homepage covers
│   ├── models/                        GLB files
│   ├── share/                         1200×630 generated share cards
│   └── THIRD_PARTY_NOTICES.txt        Sample-asset notices
├── scripts/
│   ├── check-asset-budgets.ts         Build-time size warnings
│   ├── generate-demo-audio.ts         Deterministic WAV demo assets
│   ├── generate-static-routes.ts      Physical routes and Open Graph injection
│   ├── validate-content.ts            Filesystem-aware catalog validation
│   └── capture-share-cards.ts         Playwright share-card capture with cleanup
├── src/
│   ├── main.tsx                       Browser entry
│   ├── app/
│   │   ├── App.tsx                    Providers and router mount
│   │   ├── AppShell.tsx               Shared navigation and route outlet
│   │   ├── routes.tsx                 Route definitions reusable in tests
│   │   └── siteConfig.ts              Configurable public title and origin helpers
│   ├── audio/
│   │   ├── AudioDirector.ts           Testable one-track crossfade state machine
│   │   ├── AudioProvider.tsx          Route-aware React integration
│   │   └── SoundToggle.tsx            Accessible opt-in control
│   ├── content/
│   │   ├── types.ts                   Exhibit and presentation contracts
│   │   ├── exhibits.ts                Owner-maintained catalog
│   │   ├── catalog.ts                 Lookups and derived values
│   │   └── validateExhibits.ts        Pure validation
│   ├── home/
│   │   ├── CollectionPage.tsx         Featured item and collection wall
│   │   ├── FeaturedExhibit.tsx        Primary editorial composition
│   │   └── ExhibitCard.tsx            Image-only collection card
│   ├── exhibit/
│   │   ├── ExhibitPage.tsx            Route composition and fallback content
│   │   ├── ExhibitLayout.tsx          Three layout profiles
│   │   ├── ExhibitToolbar.tsx         Camera, fullscreen, sound, animation, share
│   │   ├── ModelExperience.tsx        Suspense, error boundary, cover transition
│   │   ├── ModelScene.tsx             Canvas, model, camera, cleanup
│   │   ├── SceneEnvironment.tsx       Scene-profile registry and environment
│   │   ├── LightingRig.tsx            Named visitor-facing lighting presets
│   │   ├── AnimationController.tsx    Optional GLB animation behavior
│   │   └── usePerformanceTier.ts      Mobile rendering tier
│   ├── sharing/
│   │   ├── shareExhibit.ts            Native-share and clipboard fallback
│   │   └── ShareCardPage.tsx          Internal capture-only 1200×630 composition
│   ├── pages/
│   │   ├── AboutPage.tsx
│   │   ├── EmptyCollectionPage.tsx
│   │   └── NotFoundPage.tsx
│   ├── styles/
│   │   ├── tokens.css                 Palette, type, spacing, motion tokens
│   │   ├── global.css                 Resets, focus, shared layout
│   │   ├── home.css                   Editorial homepage and responsive grid
│   │   └── exhibit.css                Viewer layouts, controls, mobile drawer
│   └── test/
│       └── setup.ts                   Testing Library matchers and browser mocks
└── tests/
    └── e2e/gallery.spec.ts            Public browser flows and cleanup checks
```

---

### Task 1: Create the Vite, React, TypeScript, and Test Foundation

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/siteConfig.ts`
- Create: `src/test/setup.ts`
- Create: `src/app/App.test.tsx`

**Interfaces:**
- Produces: `siteConfig: { siteTitle: string; siteDescription: string }`
- Produces: a working `npm run test`, `npm run typecheck`, and `npm run build`

- [ ] **Step 1: Initialize the package and install the minimum runtime and test dependencies**

Run:

```bash
npm init -y
npm install react react-dom react-router-dom three @react-three/fiber @react-three/drei
npm install -D vite typescript tsx @vitejs/plugin-react @types/node @types/react @types/react-dom @types/three vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
```

Expected: `package.json` and `package-lock.json` exist; no application code has been generated outside the planned structure.

- [ ] **Step 2: Write the initial failing application smoke test**

Create `src/app/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { App } from "./App"

describe("App", () => {
  it("renders the configured collection title", () => {
    render(<App />)
    expect(screen.getByRole("heading", { name: "电子手办收藏站" })).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Add test, TypeScript, Vite, and HTML configuration**

Set the `package.json` scripts exactly to:

```json
{
  "scripts": {
    "dev": "vite",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b --pretty false",
    "build": "npm run typecheck && vite build",
    "preview": "vite preview"
  }
}
```

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
})
```

Create `index.html` with stable metadata markers:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!--app-meta-start-->
    <title>电子手办收藏站</title>
    <meta name="description" content="一个用于收藏与观赏数字角色模型的私人展馆。" />
    <!--app-meta-end-->
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

Create `tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "composite": true,
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "composite": true,
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["vite.config.ts", "playwright.config.ts", "scripts", "tests"]
}
```

- [ ] **Step 4: Run the test and verify the missing application fails**

Run: `npm run test -- src/app/App.test.tsx`

Expected: FAIL because `./App` does not exist.

- [ ] **Step 5: Implement the minimal configurable application**

Create `src/app/siteConfig.ts`:

```ts
export const siteConfig = {
  siteTitle: "电子手办收藏站",
  siteDescription: "一个用于收藏与观赏数字角色模型的私人展馆。",
} as const
```

Create `src/app/App.tsx`:

```tsx
import { siteConfig } from "./siteConfig"

export function App() {
  return <h1>{siteConfig.siteTitle}</h1>
}
```

Create `src/main.tsx`:

```tsx
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./app/App"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest"
```

- [ ] **Step 6: Verify the foundation**

Run:

```bash
npm run test -- src/app/App.test.tsx
npm run typecheck
npm run build
```

Expected: all three commands pass and `dist/index.html` exists.

- [ ] **Step 7: Review checkpoint**

Inspect `package.json`, `package-lock.json`, and `git diff --no-index /dev/null src/app/App.tsx` if the directory is still not a Git repository. Confirm no unplanned framework or styling dependency was added.

---

### Task 2: Define the Exhibit Domain and Validation Contract

**Files:**
- Create: `src/content/types.ts`
- Create: `src/content/exhibits.ts`
- Create: `src/content/catalog.ts`
- Create: `src/content/validateExhibits.ts`
- Create: `src/content/validateExhibits.test.ts`

**Interfaces:**
- Produces: `Exhibit`, `SceneId`, `ExhibitLayoutId`, `LightingPresetId`
- Produces: `validateExhibits(exhibits, assetExists): ValidationResult`
- Produces: `getExhibitBySlug(slug): Exhibit | undefined`
- Produces: `getFeaturedExhibit(exhibits): Exhibit | undefined`

- [ ] **Step 1: Write failing validation and lookup tests**

Create `src/content/validateExhibits.test.ts` with these cases:

```ts
import { describe, expect, it } from "vitest"
import type { Exhibit } from "./types"
import { getFeaturedExhibit, getExhibitBySlug } from "./catalog"
import { validateExhibits } from "./validateExhibits"

const exhibit: Exhibit = {
  slug: "sample-one",
  collectionNumber: "001",
  title: "样本一号",
  summary: "用于验证馆藏数据的一件样本。",
  description: "完整介绍。",
  tags: ["样本"],
  cover: "/covers/sample-one.jpg",
  model: "/models/sample-one.glb",
  featured: true,
  presentation: {
    layout: "center-stage",
    scene: "warm-cabinet",
    lightingPresets: ["warm", "rim"],
  },
}

describe("exhibit catalog", () => {
  it("rejects duplicate slugs", () => {
    const result = validateExhibits([exhibit, { ...exhibit, collectionNumber: "002" }], () => true)
    expect(result.errors).toContain("Duplicate exhibit slug: sample-one")
  })

  it("rejects missing required assets", () => {
    const result = validateExhibits([exhibit], (path) => path !== exhibit.model)
    expect(result.errors).toContain("Missing model asset: /models/sample-one.glb")
  })

  it("finds an exhibit and the sole featured exhibit", () => {
    expect(getExhibitBySlug("sample-one", [exhibit])).toEqual(exhibit)
    expect(getFeaturedExhibit([exhibit])).toEqual(exhibit)
  })
})
```

- [ ] **Step 2: Run the tests and verify missing modules fail**

Run: `npm run test -- src/content/validateExhibits.test.ts`

Expected: FAIL because the content modules do not exist.

- [ ] **Step 3: Implement exact domain types**

Create `src/content/types.ts`:

```ts
export type SceneId = "warm-cabinet" | "star-mist" | "cold-chamber"
export type ExhibitLayoutId = "center-stage" | "story-offset" | "immersive"
export type LightingPresetId = "warm" | "rim" | "moon" | "starlight" | "top" | "scan"

export type CameraPreset = {
  position: readonly [number, number, number]
  target: readonly [number, number, number]
  minDistance: number
  maxDistance: number
}

export type Exhibit = {
  slug: string
  collectionNumber: string
  title: string
  summary: string
  description: string
  tags: string[]
  year?: string
  tools?: string[]
  cover: string
  model: string
  featured?: boolean
  presentation: {
    layout: ExhibitLayoutId
    scene: SceneId
    background?: string
    camera?: CameraPreset
    lightingPresets: LightingPresetId[]
  }
  animation?: {
    mode: "static" | "autoplay" | "manual"
    clip?: string
  }
  audio?: { ambientTrack: string }
  share?: { title?: string; description?: string; image?: string }
  attribution?: { creator?: string; source?: string; license?: string }
}

export type ValidationResult = { errors: string[]; warnings: string[] }
```

- [ ] **Step 4: Implement pure validation and catalog helpers**

Implement `validateExhibits` so it checks duplicate `slug`, duplicate `collectionNumber`, exactly zero or one featured item, empty `lightingPresets`, and required cover/model existence through the injected callback. Use these signatures:

```ts
export function validateExhibits(
  exhibits: readonly Exhibit[],
  assetExists: (publicPath: string) => boolean,
): ValidationResult

export function getExhibitBySlug(
  slug: string,
  source: readonly Exhibit[] = exhibits,
): Exhibit | undefined

export function getFeaturedExhibit(
  source: readonly Exhibit[] = exhibits,
): Exhibit | undefined
```

Create `src/content/exhibits.ts` with an empty, typed catalog that keeps the build valid before sample assets arrive:

```ts
import type { Exhibit } from "./types"

export const exhibits: readonly Exhibit[] = []
```

- [ ] **Step 5: Run the focused and full verification**

Run:

```bash
npm run test -- src/content/validateExhibits.test.ts
npm run typecheck
```

Expected: PASS with no implicit `any` or duplicate-identifier errors.

- [ ] **Step 6: Review checkpoint**

Confirm all later configuration needs from the spec exist in `Exhibit`; confirm attribution remains optional and has no rendering component.

---

### Task 3: Generate Physical Static Routes and Exhibit Metadata

**Files:**
- Modify: `package.json`
- Modify: `index.html`
- Create: `.env.example`
- Create: `scripts/generate-static-routes.ts`
- Create: `scripts/generate-static-routes.test.ts`
- Create: `scripts/validate-content.ts`

**Interfaces:**
- Consumes: `Exhibit`, `exhibits`, `validateExhibits`
- Produces: `generateStaticRoutes(options): Promise<void>`
- Produces: physical `dist/about/index.html` and `dist/exhibits/<slug>/index.html`

- [ ] **Step 1: Write a failing metadata-generation test**

Use a temporary directory created by `mkdtemp` and an exhibit with `slug: "sample-one"`. The test must assert:

```ts
const generated = await readFile(join(distDir, "exhibits/sample-one/index.html"), "utf8")
expect(generated).toContain("<title>样本一号 · 电子手办收藏站</title>")
expect(generated).toContain('property="og:image" content="https://gallery.example/covers/sample-one.jpg"')
expect(generated).toContain('property="og:url" content="https://gallery.example/exhibits/sample-one/"')
```

Also assert `about/index.html` exists and still references the same absolute `/assets/` bundle paths as the root built HTML.

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- scripts/generate-static-routes.test.ts`

Expected: FAIL because `generateStaticRoutes` is missing.

- [ ] **Step 3: Implement HTML escaping, metadata injection, and physical route writing**

Export this interface from `scripts/generate-static-routes.ts`:

```ts
export type GenerateStaticRoutesOptions = {
  distDir: string
  origin: string
  exhibits: readonly Exhibit[]
  siteTitle: string
  siteDescription: string
}

export async function generateStaticRoutes(options: GenerateStaticRoutesOptions): Promise<void>
```

Implementation rules:

1. Read `dist/index.html` as the template.
2. Replace only the region between `<!--app-meta-start-->` and `<!--app-meta-end-->`.
3. Escape `&`, `<`, `>`, `"`, and `'` in content values.
4. Join URL paths through `new URL(path, origin)`.
5. Write `about/index.html` with site-level metadata.
6. Write each `exhibits/<slug>/index.html` with unique title, description, canonical URL, and Open Graph tags.
7. Use `share.image ?? cover` for `og:image`.

The injected exhibit block must contain:

```html
<!--app-meta-start-->
<title>EXHIBIT_TITLE · SITE_TITLE</title>
<meta name="description" content="EXHIBIT_SUMMARY" />
<link rel="canonical" href="ABSOLUTE_EXHIBIT_URL" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="SITE_TITLE" />
<meta property="og:title" content="SHARE_TITLE" />
<meta property="og:description" content="SHARE_DESCRIPTION" />
<meta property="og:image" content="ABSOLUTE_SHARE_IMAGE" />
<meta property="og:image:alt" content="EXHIBIT_TITLE 的馆藏封面" />
<meta property="og:url" content="ABSOLUTE_EXHIBIT_URL" />
<!--app-meta-end-->
```

- [ ] **Step 4: Add filesystem-aware catalog validation**

Create `scripts/validate-content.ts` that maps `/models/x.glb` to `public/models/x.glb`, runs `validateExhibits`, prints every warning, prints every error to stderr, and exits with code 1 when errors exist.

Create `.env.example`:

```dotenv
PUBLIC_ORIGIN=https://gallery.example
```

Update scripts to:

```json
{
  "validate:content": "tsx scripts/validate-content.ts",
  "generate:routes": "tsx scripts/generate-static-routes.ts",
  "build": "npm run typecheck && npm run validate:content && vite build && npm run generate:routes"
}
```

The command-line entry in `generate-static-routes.ts` must read `PUBLIC_ORIGIN`, default to `http://localhost:4173` for local builds, and invoke the exported function.

- [ ] **Step 5: Verify metadata generation and the complete build**

Run:

```bash
npm run test -- scripts/generate-static-routes.test.ts
PUBLIC_ORIGIN=https://gallery.example npm run build
```

Expected: PASS; `dist/about/index.html` exists. No exhibit route exists yet because the catalog is empty.

- [ ] **Step 6: Review checkpoint**

Open `dist/about/index.html` as text and confirm metadata markers were replaced once, asset URLs remain absolute, and no hosting-provider rewrite is required.

---

### Task 4: Build the Application Shell, Routing, and Base States

**Files:**
- Modify: `src/app/App.tsx`
- Create: `src/app/AppShell.tsx`
- Create: `src/app/routes.tsx`
- Create: `src/app/routes.test.tsx`
- Create: `src/pages/AboutPage.tsx`
- Create: `src/pages/EmptyCollectionPage.tsx`
- Create: `src/pages/NotFoundPage.tsx`
- Create: `src/exhibit/ExhibitPage.tsx`
- Create: `src/home/CollectionPage.tsx`
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`

**Interfaces:**
- Consumes: catalog helpers from Task 2
- Produces: `appRoutes` usable by browser and memory routers
- Produces: semantic page-level empty and not-found states

- [ ] **Step 1: Write failing direct-route tests**

Create tests using `createMemoryRouter(appRoutes, { initialEntries })` and `RouterProvider`:

```tsx
it("renders the empty collection at the root", async () => {
  renderRoute("/")
  expect(await screen.findByRole("heading", { name: "馆藏正在整理中" })).toBeInTheDocument()
})

it("renders the about page", async () => {
  renderRoute("/about/")
  expect(await screen.findByRole("heading", { name: "关于这个收藏站" })).toBeInTheDocument()
})

it("renders a designed not-found state", async () => {
  renderRoute("/missing/")
  expect(await screen.findByRole("heading", { name: "没有找到这件藏品" })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm run test -- src/app/routes.test.tsx`

Expected: FAIL because route modules are missing.

- [ ] **Step 3: Implement reusable route definitions and the shared shell**

Export `appRoutes` as `RouteObject[]` containing:

```tsx
export const appRoutes: RouteObject[] = [{
  element: <AppShell />,
  children: [
    { path: "/", element: <CollectionPage /> },
    { path: "/about/", element: <AboutPage /> },
    { path: "/exhibits/:slug/", element: <ExhibitPage /> },
    { path: "*", element: <NotFoundPage /> },
  ],
}]
```

`AppShell` renders a skip link, semantic header with configurable `siteTitle`, links to `/` and `/about/`, `<main id="main-content"><Outlet /></main>`, and a restrained footer. Do not add the sound toggle until Task 9.

`CollectionPage` checks `exhibits.length`; render `EmptyCollectionPage` when zero. `ExhibitPage` reads `slug`, looks it up, and renders `NotFoundPage` when missing.

- [ ] **Step 4: Add foundational design tokens and focus behavior**

Create these root tokens in `src/styles/tokens.css`:

```css
:root {
  color-scheme: dark;
  --ink-950: #0d0b0c;
  --ink-900: #151112;
  --wood-700: #4a2d22;
  --amber-400: #d8a66d;
  --paper-100: #f3e8da;
  --mist-300: #b9a89b;
  --focus: #ffd08a;
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --radius-card: 1rem;
  --duration-fast: 160ms;
  --duration-page: 420ms;
}
```

`global.css` must include visible `:focus-visible`, the skip-link reveal, readable default line height, and a reduced-motion rule that reduces animation and transition durations to `0.01ms`.

- [ ] **Step 5: Run route, type, and build verification**

Run:

```bash
npm run test -- src/app/routes.test.tsx
npm run typecheck
npm run build
```

Expected: PASS; the empty catalog does not cause the build to fail.

- [ ] **Step 6: Review checkpoint**

Run `npm run dev`, inspect `/`, `/about/`, and `/missing/`, then stop the server. Confirm keyboard focus reaches the skip link and navigation.

---

### Task 5: Add Three Licensed Sample Exhibits and Catalog Content

**Files:**
- Create: `public/models/avocado.glb`
- Create: `public/models/antique-camera.glb`
- Create: `public/models/fox.glb`
- Create: `public/covers/avocado.jpg`
- Create: `public/covers/antique-camera.jpg`
- Create: `public/covers/fox.jpg`
- Create: `public/THIRD_PARTY_NOTICES.txt`
- Modify: `src/content/exhibits.ts`
- Create: `src/content/exhibits.test.ts`

**Interfaces:**
- Consumes: `Exhibit` and `validateExhibits`
- Produces: three build-valid exhibits spanning all layout and scene profiles

- [ ] **Step 1: Write a failing catalog acceptance test**

Create `src/content/exhibits.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { exhibits } from "./exhibits"
import { validateExhibits } from "./validateExhibits"

describe("sample exhibit catalog", () => {
  it("contains three unique exhibits and one featured item", () => {
    const result = validateExhibits(exhibits, () => true)
    expect(result.errors).toEqual([])
    expect(exhibits).toHaveLength(3)
    expect(exhibits.filter((item) => item.featured)).toHaveLength(1)
    expect(new Set(exhibits.map((item) => item.presentation.layout)).size).toBe(3)
    expect(new Set(exhibits.map((item) => item.presentation.scene)).size).toBe(3)
  })
})
```

- [ ] **Step 2: Download exact official sample assets and covers**

Run:

```bash
mkdir -p public/models public/covers public/share public/audio
curl -fL https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Avocado/glTF-Binary/Avocado.glb -o public/models/avocado.glb
curl -fL https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/AntiqueCamera/glTF-Binary/AntiqueCamera.glb -o public/models/antique-camera.glb
curl -fL https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Fox/glTF-Binary/Fox.glb -o public/models/fox.glb
curl -fL https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Avocado/screenshot/screenshot.jpg -o public/covers/avocado.jpg
curl -fL https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/AntiqueCamera/screenshot/screenshot.jpg -o public/covers/antique-camera.jpg
curl -fL https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Fox/screenshot/screenshot.jpg -o public/covers/fox.jpg
```

Expected: all six requests return successfully. Do not compute hashes; validate through file presence, MIME use in the app, and model loading.

- [ ] **Step 3: Record exact third-party notices**

Create `public/THIRD_PARTY_NOTICES.txt` with the Khronos repository URL, model URLs, and these license summaries:

```text
Avocado — © 2017 Public; CC0 1.0 Universal; Microsoft for model content.
Antique Camera — © 2018 UX3D; CC0 1.0 Universal; model contains an identified UX3D mark.
Fox — model CC0 1.0; rigging, animation, and glTF conversion CC BY 4.0; credits: PixelMannen, tomkranis, AsoboStudio, and scurest.
Source: https://github.com/KhronosGroup/glTF-Sample-Assets
```

- [ ] **Step 4: Implement the three typed exhibit entries**

Use these stable configurations in `src/content/exhibits.ts`:

```ts
export const exhibits: readonly Exhibit[] = [
  {
    slug: "green-core",
    collectionNumber: "001",
    title: "翠核标本",
    summary: "一枚被当作未知生命核心保存的绿色标本。",
    description: "它没有角色履历，却像某种沉睡生命留下的核心。第一件馆藏用它验证材质、微小物体构图与暖色陈列。",
    tags: ["有机", "静态", "材质"],
    cover: "/covers/avocado.jpg",
    model: "/models/avocado.glb",
    featured: true,
    presentation: { layout: "center-stage", scene: "warm-cabinet", lightingPresets: ["warm", "rim"] },
    animation: { mode: "static" },
    attribution: { creator: "Microsoft", source: "Khronos glTF Sample Assets", license: "CC0-1.0" },
  },
  {
    slug: "silent-observer",
    collectionNumber: "002",
    title: "静默观测者",
    summary: "一台来自旧时代的观测装置，被重新安置在冷光舱室。",
    description: "机械结构与镜头形成类似角色面孔的轮廓，用于验证宽体模型、偏置叙事和冷色灯光。",
    tags: ["机械", "静态", "旧物"],
    cover: "/covers/antique-camera.jpg",
    model: "/models/antique-camera.glb",
    presentation: { layout: "story-offset", scene: "cold-chamber", lightingPresets: ["top", "scan"] },
    animation: { mode: "static" },
    attribution: { creator: "UX3D", source: "Khronos glTF Sample Assets", license: "CC0-1.0" },
  },
  {
    slug: "wilderness-messenger",
    collectionNumber: "003",
    title: "旷野信使",
    summary: "一只携带三段行动记忆、穿行于星雾之间的信使。",
    description: "横向体态与多段骨骼动画用于验证沉浸构图、动画选择和移动端镜头边界。",
    tags: ["生物", "动画", "信使"],
    cover: "/covers/fox.jpg",
    model: "/models/fox.glb",
    presentation: { layout: "immersive", scene: "star-mist", lightingPresets: ["moon", "starlight"] },
    animation: { mode: "manual", clip: "Survey" },
    attribution: { creator: "PixelMannen et al.", source: "Khronos glTF Sample Assets", license: "CC0-1.0 AND CC-BY-4.0" },
  },
]
```

- [ ] **Step 5: Verify catalog, files, physical routes, and budget assumptions**

Run:

```bash
npm run test -- src/content/exhibits.test.ts
npm run validate:content
PUBLIC_ORIGIN=https://gallery.example npm run build
```

Expected: PASS; three `dist/exhibits/*/index.html` files exist. Antique Camera may exceed the 15 MB target but remains below the later 25 MB warning threshold.

- [ ] **Step 6: Review checkpoint**

Inspect the generated HTML titles and `public/THIRD_PARTY_NOTICES.txt`. Confirm attribution is stored but no exhibit UI renders it.

---

### Task 6: Implement the Editorial Homepage

**Files:**
- Modify: `src/home/CollectionPage.tsx`
- Create: `src/home/FeaturedExhibit.tsx`
- Create: `src/home/ExhibitCard.tsx`
- Create: `src/home/CollectionPage.test.tsx`
- Create: `src/styles/home.css`

**Interfaces:**
- Consumes: `exhibits`, `getFeaturedExhibit`, `Exhibit`
- Produces: image-only homepage cards and featured-exhibit navigation

- [ ] **Step 1: Load `frontend-design` and write failing homepage behavior tests**

Tests must assert:

```tsx
render(<MemoryRouter><CollectionPage /></MemoryRouter>)
expect(screen.getByRole("heading", { name: "翠核标本" })).toBeInTheDocument()
expect(screen.getAllByRole("article")).toHaveLength(3)
expect(screen.getByRole("link", { name: /进入翠核标本展厅/ })).toHaveAttribute("href", "/exhibits/green-core/")
expect(document.querySelector("canvas")).not.toBeInTheDocument()
```

- [ ] **Step 2: Run the test and verify the editorial components are missing**

Run: `npm run test -- src/home/CollectionPage.test.tsx`

Expected: FAIL on missing card and featured composition.

- [ ] **Step 3: Implement featured and card components with semantic HTML**

Use exact component contracts:

```ts
export function FeaturedExhibit({ exhibit }: { exhibit: Exhibit }): JSX.Element
export function ExhibitCard({ exhibit }: { exhibit: Exhibit }): JSX.Element
```

Each `ExhibitCard` is an `<article>` containing one lazy `<img>`, collection number, title, summary, tags, and an animation badge only when `animation.mode !== "static"`. The whole meaningful card area links to `/exhibits/${slug}/` without nested buttons.

`FeaturedExhibit` uses `fetchPriority="high"` on its image, renders the full summary, and labels its link `进入${title}展厅`.

- [ ] **Step 4: Implement the warm editorial grid without fixed mobile heights**

In `home.css`:

- Use a two-column featured composition above `64rem`, one column below.
- Use an asymmetric CSS grid for the collection wall above `52rem` and a single column below `42rem`.
- Apply `aspect-ratio` to cover frames instead of fixed pixel height.
- Give images `object-fit: cover` and preserve readable overlay contrast.
- Animate only transform, opacity, and a restrained highlight; disable these effects under reduced motion.
- Ensure long Chinese titles wrap and do not overlap collection numbers.

- [ ] **Step 5: Verify behavior and render at mobile and desktop widths**

Run:

```bash
npm run test -- src/home/CollectionPage.test.tsx
npm run typecheck
npm run build
```

Then run the development server, inspect at 390×844 and 1440×900, and stop the server.

Expected: no horizontal overflow; exactly zero canvases on the homepage; all cards remain keyboard reachable.

- [ ] **Step 6: Review checkpoint**

Compare the rendered homepage against the approved “featured exhibit + collection wall” direction. Reject generic dashboard cards, neon gradients, and uniform three-column tiles.

---

### Task 7: Build Reusable 3D Loading, Scene Profiles, and Fallbacks

**Files:**
- Create: `src/exhibit/sceneProfiles.ts`
- Create: `src/exhibit/sceneProfiles.test.ts`
- Create: `src/exhibit/usePerformanceTier.ts`
- Create: `src/exhibit/SceneEnvironment.tsx`
- Create: `src/exhibit/ModelScene.tsx`
- Create: `src/exhibit/ModelExperience.tsx`
- Create: `src/exhibit/ModelErrorBoundary.tsx`
- Create: `src/exhibit/ModelExperience.test.tsx`

**Interfaces:**
- Consumes: `SceneId`, `CameraPreset`, exhibit `model` and `cover`
- Produces: `sceneProfiles: Record<SceneId, SceneProfile>`
- Produces: `ModelExperience({ exhibit, onReady, controlsRef })`
- Produces: `ModelControlsHandle.resetCamera()`

- [ ] **Step 1: Write failing pure scene-profile tests**

Define the expected contract in the test:

```ts
expect(sceneProfiles["warm-cabinet"].defaultCamera.position).toEqual([0, 0.4, 4.2])
expect(sceneProfiles["star-mist"].mobile.disableParticles).toBe(true)
expect(sceneProfiles["cold-chamber"].allowedLighting).toEqual(["top", "scan"])
```

Also mock `ModelScene` with `vi.mock("./ModelScene", () => ({ ModelScene: () => { throw new Error("model failed") } }))`, render `ModelExperience`, and assert the cover, description, and `重新加载模型` button remain visible.

- [ ] **Step 2: Run tests and verify missing scene modules fail**

Run: `npm run test -- src/exhibit/sceneProfiles.test.ts src/exhibit/ModelExperience.test.tsx`

Expected: FAIL because the registry and component do not exist.

- [ ] **Step 3: Implement the scene-profile registry**

Use this exact interface:

```ts
type SceneProfile = {
  background: string
  fog?: { color: string; near: number; far: number }
  defaultCamera: CameraPreset
  allowedLighting: LightingPresetId[]
  mobile: { disableParticles: boolean; shadows: boolean; maxDpr: number }
}
```

Provide values for all three scene IDs. Keep particles declarative as a boolean capability; do not introduce a particle dependency.

- [ ] **Step 4: Implement performance tier and the R3F canvas**

`usePerformanceTier` returns:

```ts
type PerformanceTier = { mobile: boolean; dpr: [number, number]; shadows: boolean }
```

Use `matchMedia("(max-width: 720px)")`, device memory only when available, and the scene profile's `maxDpr`. `ModelScene` renders `Canvas`, `Suspense`, `Bounds`, `useGLTF`, `OrbitControls`, and `SceneEnvironment`. Clamp polar angles and distances from the active camera preset. Call `onReady` once after the GLB scene is attached.

Clone the loaded scene into an exhibit-owned instance. Use `SkeletonUtils.clone(scene)` for skinned models, then clone each mesh geometry and material so cleanup cannot dispose `useGLTF` cache objects shared with another instance:

```ts
const ownedScene = useMemo(() => {
  const clone = SkeletonUtils.clone(scene)
  clone.traverse((object) => {
    if (!(object instanceof Mesh)) return
    object.geometry = object.geometry.clone()
    object.material = Array.isArray(object.material)
      ? object.material.map((material) => material.clone())
      : object.material.clone()
  })
  return clone
}, [scene])
```

On unmount, stop animations and dispose only geometries, materials, and textures belonging to `ownedScene`. Do not dispose shared renderer or `useGLTF` cache resources.

- [ ] **Step 5: Implement cover-first loading, retry, and WebGL fallback**

`ModelExperience` must:

1. Render the cover and textual status immediately.
2. Feature-detect WebGL before mounting `Canvas`.
3. Fade the canvas in only after `onReady`.
4. Catch loader/render errors with `ModelErrorBoundary`.
5. Retry by incrementing a key and remounting only the 3D subtree.
6. Leave cover, exhibit title, summary, and later share controls outside the error boundary.

- [ ] **Step 6: Verify pure logic, fallback behavior, type safety, and production bundle**

Run:

```bash
npm run test -- src/exhibit/sceneProfiles.test.ts src/exhibit/ModelExperience.test.tsx
npm run typecheck
npm run build
```

Expected: PASS; homepage bundle remains route-split from Three.js code.

- [ ] **Step 7: Review checkpoint**

Open all three exhibit routes, verify each GLB appears, then navigate among them repeatedly. Use browser memory tooling if available to confirm canvas count returns to one and animation/render loops do not accumulate.

---

### Task 8: Add Exhibit Layouts, Lighting Presets, Camera Tools, and Animation

**Files:**
- Modify: `src/exhibit/ExhibitPage.tsx`
- Create: `src/exhibit/ExhibitLayout.tsx`
- Create: `src/exhibit/LightingRig.tsx`
- Create: `src/exhibit/lightingPresets.ts`
- Create: `src/exhibit/AnimationController.tsx`
- Create: `src/exhibit/ExhibitToolbar.tsx`
- Create: `src/exhibit/ExhibitPage.test.tsx`
- Create: `src/styles/exhibit.css`

**Interfaces:**
- Consumes: `Exhibit`, `ModelControlsHandle`, `LightingPresetId`
- Produces: `ExhibitLayout({ layout, viewer, information })`
- Produces: `LightingRig({ preset })`
- Produces: optional `AnimationControlsState`

- [ ] **Step 1: Write failing exhibit configuration tests**

Mock `ModelExperience` and assert:

```tsx
renderExhibit("/exhibits/wilderness-messenger/")
expect(screen.getByRole("heading", { name: "旷野信使" })).toBeInTheDocument()
expect(screen.getByRole("button", { name: "播放动画" })).toBeInTheDocument()
expect(screen.getByRole("button", { name: "切换到月光灯光" })).toBeInTheDocument()

renderExhibit("/exhibits/green-core/")
expect(screen.queryByRole("button", { name: "播放动画" })).not.toBeInTheDocument()
```

Add a test that `story-offset`, `center-stage`, and `immersive` produce distinct `data-layout` values.

- [ ] **Step 2: Run tests and verify controls and layouts fail**

Run: `npm run test -- src/exhibit/ExhibitPage.test.tsx`

Expected: FAIL because the configured exhibit interface is not implemented.

- [ ] **Step 3: Implement the three layout profiles and information panel**

Use this contract:

```tsx
export function ExhibitLayout(props: {
  layout: ExhibitLayoutId
  viewer: ReactNode
  information: ReactNode
  toolbar: ReactNode
}): JSX.Element
```

Render the same semantic information in every layout: collection number, title, summary, description, tags, optional year/tools. Change spatial composition through `data-layout` and CSS grid areas, not duplicate page components.

- [ ] **Step 4: Implement named lighting rigs**

Create a pure `lightingPresets` registry with intensity, color, position, and shadow flags. `LightingRig` maps the selected ID to ambient, directional, spot, or point lights. Exhibit controls may select only IDs listed in `exhibit.presentation.lightingPresets`.

The initial selected preset is the first configured value. Reset it when the route slug changes.

- [ ] **Step 5: Implement animation modes and camera/fullscreen tools**

`AnimationController` uses `useAnimations(animations, scene)` and applies:

```ts
export type AnimationControlsState = {
  available: boolean
  playing: boolean
  toggle(): void
}
```

```ts
static   -> stop all clips; expose no button
autoplay -> play configured clip or first clip; loop
manual   -> start stopped; expose play/pause for configured clip or first clip
```

When a configured clip is absent, expose no animation button and emit one development warning.

`ExhibitToolbar` includes reset camera, fullscreen, lighting preset buttons, and optional animation play/pause. Fullscreen targets the exhibit viewer container and handles rejected fullscreen promises without crashing.

- [ ] **Step 6: Implement responsive detail layouts**

Use grid and `min-height`, not hard desktop heights. On narrow screens:

- Stack viewer above information.
- Give the viewer `min-height: min(62svh, 36rem)` with content-safe fallback.
- Place secondary controls in an accessible `<details>` bottom panel.
- Keep back, reset, and later share/sound controls visible.
- Verify long descriptions scroll the page rather than create nested scroll traps.

- [ ] **Step 7: Verify tests, three representative models, and mobile controls**

Run:

```bash
npm run test -- src/exhibit/ExhibitPage.test.tsx
npm run typecheck
npm run build
```

Inspect all exhibit routes at 390×844 and 1440×900. Expected: no control overlaps the model's primary silhouette; Fox animation can be started and paused.

- [ ] **Step 8: Review checkpoint**

Confirm pages feel related through typography and controls while the three scene/layout combinations remain visibly different.

---

### Task 9: Implement Opt-In Global Audio and Route Crossfades

**Files:**
- Create: `scripts/generate-demo-audio.ts`
- Create: `public/audio/collection-theme.wav`
- Create: `public/audio/fox-ambient.wav`
- Modify: `src/app/siteConfig.ts`
- Modify: `src/content/exhibits.ts`
- Create: `src/audio/AudioDirector.ts`
- Create: `src/audio/AudioDirector.test.ts`
- Create: `src/audio/AudioProvider.tsx`
- Create: `src/audio/SoundToggle.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/AppShell.tsx`
- Modify: `src/exhibit/ExhibitToolbar.tsx`

**Interfaces:**
- Produces: `AudioDirector.enable()`, `enterCollection()`, `enterExhibit(track?)`, `suspend()`, `resume()`, `dispose()`
- Produces: `useAudio(): { enabled: boolean; toggle(): Promise<void>; resetExhibitTrack(): void; activateExhibitTrack(track?: string): void }`

- [ ] **Step 1: Write failing fake-timer audio-state tests**

Inject fake tracks with observable `volume`, `play`, `pause`, and `currentTime`. Test:

```ts
director.enterCollection()
expect(theme.play).not.toHaveBeenCalled()

await director.enable()
expect(theme.play).toHaveBeenCalledOnce()

director.enterExhibit("/audio/fox-ambient.wav")
vi.advanceTimersByTime(1000)
expect(theme.volume).toBe(0)
expect(ambient.volume).toBeCloseTo(1)

director.enterExhibit(undefined)
vi.advanceTimersByTime(1000)
expect(theme.volume).toBeCloseTo(0.35)
```

- [ ] **Step 2: Run tests and verify the director is missing**

Run: `npm run test -- src/audio/AudioDirector.test.ts`

Expected: FAIL because `AudioDirector` does not exist.

- [ ] **Step 3: Implement a single-principal-track director**

Use injected interfaces so tests never play sound:

```ts
export type AudioTrack = Pick<HTMLAudioElement, "play" | "pause" | "volume" | "currentTime" | "loop">
export type CreateTrack = (src: string) => AudioTrack

export class AudioDirector {
  constructor(options: {
    themeSrc: string
    createTrack: CreateTrack
    durationMs?: number
    storage?: Pick<Storage, "getItem" | "setItem">
  })
}
```

Keep at most one active ambient instance. Cancel an in-progress fade before starting another. Catch rejected `play()` promises and leave `enabled` false. Store the preference under `digital-figure-gallery:sound-enabled` only after successful opt-in.

- [ ] **Step 4: Generate two deterministic copyright-free WAV demonstration tracks**

Create `scripts/generate-demo-audio.ts` using only Node APIs. Use 22,050 Hz, 16-bit mono, eight seconds, and a 200 ms edge fade. The core generator is:

```ts
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

const sampleRate = 22_050
const seconds = 8

function writeAmbientWav(path: string, frequencies: readonly number[], gain: number) {
  const sampleCount = sampleRate * seconds
  const data = Buffer.alloc(sampleCount * 2)
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate
    const edge = Math.min(1, index / (sampleRate * 0.2), (sampleCount - 1 - index) / (sampleRate * 0.2))
    const wave = frequencies.reduce((sum, frequency, harmonic) => {
      return sum + Math.sin(2 * Math.PI * frequency * time + harmonic * 0.7) / frequencies.length
    }, 0)
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, wave * gain * edge)) * 32_767), index * 2)
  }

  const header = Buffer.alloc(44)
  header.write("RIFF", 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write("WAVEfmt ", 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write("data", 36)
  header.writeUInt32LE(data.length, 40)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, Buffer.concat([header, data]))
}

writeAmbientWav(resolve("public/audio/collection-theme.wav"), [55, 82.5, 110], 0.12)
writeAmbientWav(resolve("public/audio/fox-ambient.wav"), [73.5, 110, 147], 0.09)
```

Run: `tsx scripts/generate-demo-audio.ts`

Update `siteConfig` with `themeTrack: "/audio/collection-theme.wav"` and add `audio: { ambientTrack: "/audio/fox-ambient.wav" }` to the Fox exhibit. These WAV files demonstrate state and crossfades and can be replaced with curated audio without code changes.

- [ ] **Step 5: Integrate route-aware audio through React context**

`AudioProvider` observes `location.pathname` and the current exhibit:

- `/` and `/about/` call `enterCollection()`.
- Entering any exhibit route first calls `enterExhibit(undefined)`, which keeps the theme at 35% and prevents audio from racing ahead of the model.
- `ExhibitPage` calls `resetExhibitTrack()` whenever the slug changes.
- `ModelExperience.onReady` calls `activateExhibitTrack(exhibit.audio?.ambientTrack)`; this switches to ambience only after model readiness.
- An exhibit without ambience remains on the reduced-volume theme.
- `visibilitychange` invokes `suspend` and `resume`.

Integration tests must verify both the Fox ambience path and the reduced-volume theme path used by the other two samples.

- [ ] **Step 6: Add accessible sound controls**

Render `SoundToggle` in shared navigation and the exhibit toolbar. Both controls point to the same context state and use labels `开启声音` and `关闭声音`. Do not use autoplay on mount.

- [ ] **Step 7: Verify audio logic and browser silence on first load**

Run:

```bash
npm run test -- src/audio/AudioDirector.test.ts
npm run typecheck
npm run build
```

Open the site in a fresh browser context. Expected: no audio request begins until `开启声音` is activated; disabling sound pauses and resets all tracks.

- [ ] **Step 8: Review checkpoint**

Confirm the generated WAV files remain below the 3 MB budget, do not clip, and are described as demonstration assets rather than final music. Confirm no third-party audio was downloaded.

---

### Task 10: Add Native Sharing, Clipboard Fallback, and Share-Card Capture

**Files:**
- Create: `src/sharing/shareExhibit.ts`
- Create: `src/sharing/shareExhibit.test.ts`
- Create: `src/sharing/ShareCardPage.tsx`
- Modify: `src/app/routes.tsx`
- Modify: `src/exhibit/ExhibitToolbar.tsx`
- Create: `scripts/capture-share-cards.ts`
- Create: `public/share/.gitkeep`

**Interfaces:**
- Consumes: `Exhibit`, `siteConfig`
- Produces: `shareExhibit(exhibit, env): Promise<"shared" | "copied" | "cancelled">`
- Produces: `npm run share:cards`

- [ ] **Step 1: Write failing native-share and clipboard tests**

Test these paths with injected environment functions:

```ts
await expect(shareExhibit(exhibit, nativeEnv)).resolves.toBe("shared")
expect(nativeEnv.share).toHaveBeenCalledWith({
  title: "翠核标本",
  text: "一枚被当作未知生命核心保存的绿色标本。",
  url: "https://gallery.example/exhibits/green-core/",
})

await expect(shareExhibit(exhibit, clipboardEnv)).resolves.toBe("copied")
expect(clipboardEnv.writeText).toHaveBeenCalledWith("https://gallery.example/exhibits/green-core/")
```

Rejecting with an abort-style error returns `"cancelled"`; other native-share errors fall back to clipboard.

- [ ] **Step 2: Run tests and verify sharing is missing**

Run: `npm run test -- src/sharing/shareExhibit.test.ts`

Expected: FAIL because the function does not exist.

- [ ] **Step 3: Implement injected native sharing with canonical URLs**

Use this interface:

```ts
type ShareEnvironment = {
  origin: string
  canNativeShare: boolean
  share(data: ShareData): Promise<void>
  writeText(text: string): Promise<void>
}
```

The UI reports `链接已复制` in an `aria-live="polite"` region for two seconds after clipboard success. Share controls remain outside the 3D error boundary.

- [ ] **Step 4: Add an internal share-card route**

Add `/__share-card/:slug/` only when `import.meta.env.DEV`. `ShareCardPage` renders exactly 1200×630 CSS pixels with the exhibit cover, title, collection number, summary, site title, and a dark warm editorial treatment. It contains no canvas and marks its root `data-share-card`.

- [ ] **Step 5: Implement a cleanup-safe Playwright capture script**

`scripts/capture-share-cards.ts` must:

1. Spawn `npm run dev -- --host 127.0.0.1 --port 4174` with a task-specific environment.
2. Wait for `http://127.0.0.1:4174/` to respond.
3. Launch Chromium with viewport 1200×630.
4. Visit each internal share-card route.
5. Screenshot `[data-share-card]` to `public/share/<slug>.png`.
6. Close the page and browser in `finally`.
7. Terminate only the spawned Vite child in `finally` and wait for its exit.

Add the script:

```json
{
  "share:cards": "tsx scripts/capture-share-cards.ts"
}
```

After capture, update each sample exhibit `share.image` to `/share/<slug>.png`.

- [ ] **Step 6: Generate cards and verify metadata uses them**

Run:

```bash
npx playwright install chromium
npm run share:cards
PUBLIC_ORIGIN=https://gallery.example npm run build
npm run test -- src/sharing/shareExhibit.test.ts scripts/generate-static-routes.test.ts
```

Expected: three 1200×630 PNG files exist; generated exhibit HTML uses absolute `/share/<slug>.png` Open Graph URLs.

- [ ] **Step 7: Verify browser automation cleanup**

Use task-owned PID tracking or `lsof -nP -iTCP:4174 -sTCP:LISTEN`. Expected: no listener remains on port 4174 and no task-owned Chromium profile/process remains.

- [ ] **Step 8: Review checkpoint**

Inspect all three PNG files and one generated exhibit HTML file. Confirm cards remain legible when visually reduced to chat-preview size.

---

### Task 11: Add Asset Budgets, Resilience, and Accessibility Verification

**Files:**
- Create: `scripts/check-asset-budgets.ts`
- Create: `scripts/check-asset-budgets.test.ts`
- Modify: `package.json`
- Modify: `src/exhibit/ModelExperience.tsx`
- Modify: `src/styles/global.css`
- Modify: `src/styles/exhibit.css`
- Modify: `src/pages/NotFoundPage.tsx`
- Modify: `src/pages/EmptyCollectionPage.tsx`

**Interfaces:**
- Produces: `checkAssetBudgets(publicDir, exhibits): BudgetFinding[]`
- Produces: non-blocking warnings during production build

- [ ] **Step 1: Write failing budget tests**

Use in-memory file sizes through an injected `statSize` function and assert:

```ts
expect(findings).toContainEqual({
  level: "warning",
  path: "/models/heavy.glb",
  message: "GLB exceeds 25 MB warning threshold",
})
```

Also cover a 301 KB homepage cover and a 3.1 MB audio file.

- [ ] **Step 2: Run the budget test and verify it fails**

Run: `npm run test -- scripts/check-asset-budgets.test.ts`

Expected: FAIL because the checker is missing.

- [ ] **Step 3: Implement warnings without hashing or build failure**

Export:

```ts
export type BudgetFinding = { level: "warning"; path: string; message: string }
export function checkAssetBudgets(
  publicDir: string,
  exhibits: readonly Exhibit[],
  statSize?: (absolutePath: string) => number,
): BudgetFinding[]
```

Check model, cover, share image, and optional ambience paths. Print warnings but do not fail the build. Add:

```json
{
  "check:assets": "tsx scripts/check-asset-budgets.ts",
  "build": "npm run typecheck && npm run validate:content && npm run check:assets && vite build && npm run generate:routes"
}
```

- [ ] **Step 4: Complete accessibility and resilience behaviors**

Verify and correct:

- Every toolbar icon has an accessible name.
- Focus returns to the triggering control when the mobile `<details>` panel closes.
- Model loading status uses `role="status"`; model failure uses `role="alert"` without repeated announcements.
- Not-found and empty states contain one primary heading and a link back to `/`.
- Reduced motion disables idle rotation and cover-to-canvas fade.
- WebGL fallback contains the same descriptive text and share action as the interactive page.
- Long titles, tags, and descriptions wrap without horizontal overflow.

- [ ] **Step 5: Run targeted and complete verification**

Run:

```bash
npm run test -- scripts/check-asset-budgets.test.ts
npm run test
npm run typecheck
PUBLIC_ORIGIN=https://gallery.example npm run build
```

Expected: PASS. Asset warnings are visible but do not fail the build.

- [ ] **Step 6: Review checkpoint**

Use keyboard-only navigation and a reduced-motion browser setting on homepage and one exhibit. Confirm focus is visible and no essential operation depends on hover.

---

### Task 12: Add End-to-End Coverage, Deployment Documentation, and Final Verification

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/gallery.spec.ts`
- Create: `README.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: complete static app and generated routes
- Produces: `npm run test:e2e` and operator documentation

- [ ] **Step 1: Load the `playwright` skill and write end-to-end tests**

Configure Playwright with a task-owned server:

```ts
export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173",
    port: 4173,
    reuseExistingServer: false,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true } },
  ],
})
```

`gallery.spec.ts` must cover:

```ts
test("homepage uses images without canvases", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "翠核标本" })).toBeVisible()
  await expect(page.locator("canvas")).toHaveCount(0)
})

test("direct exhibit URL loads full content and one canvas", async ({ page }) => {
  await page.goto("/exhibits/wilderness-messenger/")
  await expect(page.getByRole("heading", { name: "旷野信使" })).toBeVisible()
  await expect(page.locator("canvas")).toHaveCount(1)
})

test("sound is opt-in", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("button", { name: "开启声音" })).toBeVisible()
})

test("unknown route remains navigable", async ({ page }) => {
  await page.goto("/exhibits/unknown/")
  await expect(page.getByRole("heading", { name: "没有找到这件藏品" })).toBeVisible()
  await expect(page.getByRole("link", { name: "返回馆藏" })).toBeVisible()
})
```

Add one route-navigation loop that visits all three exhibits twice and asserts the DOM never contains more than one canvas.

- [ ] **Step 2: Add scripts and run the failing browser suite**

Add:

```json
{
  "test:e2e": "playwright test",
  "verify": "npm run test && npm run typecheck && PUBLIC_ORIGIN=https://gallery.example npm run build && npm run test:e2e"
}
```

Run: `npm run test:e2e`

Expected on first run: identify any real route, timing, WebGL, or selector failures rather than weakening assertions.

- [ ] **Step 3: Fix only failures exposed by the end-to-end suite**

Apply targeted changes to the responsible source files. For WebGL-unavailable CI, assert the static fallback instead of skipping the exhibit test:

```ts
const canvas = page.locator("canvas")
const fallback = page.getByText("此设备暂时无法显示互动 3D")
await expect(canvas.or(fallback)).toBeVisible()
```

- [ ] **Step 4: Write operator and content-maintenance documentation**

`README.md` must include:

- Requirements and install command
- `npm run dev`, `npm run verify`, `npm run share:cards`, and production build commands
- Required `PUBLIC_ORIGIN`
- Exact steps to add an exhibit: copy GLB, cover, optional audio; add one `Exhibit`; generate share card; validate and build
- Asset budgets and GLB-only rule
- Explanation that attribution fields are stored but sample notices live in `public/THIRD_PARTY_NOTICES.txt`
- Static hosting requirement for HTTPS and correct GLB/audio MIME types
- Statement that the brand name remains configurable in `src/app/siteConfig.ts`

- [ ] **Step 5: Run final verification from a clean application state**

Run:

```bash
npm run verify
```

Expected: unit tests, type checking, catalog validation, asset-budget checks, Vite build, static-route generation, and both desktop/mobile Playwright projects pass.

- [ ] **Step 6: Inspect final output and browser-process cleanup**

Verify:

```bash
lsof -nP -iTCP:4173 -sTCP:LISTEN
lsof -nP -iTCP:4174 -sTCP:LISTEN
```

Expected: no output. Confirm no task-owned Chromium renderer, GPU, crash-handler, driver, or automation-daemon process remains. Do not close pre-existing user browser sessions.

- [ ] **Step 7: Final review checkpoint**

Inspect all files changed during implementation, the final production output structure, and the results of `npm run verify`. Report changed files, executed validation, the presence of generated demonstration audio versus owner-supplied final audio, and any asset-license caveat. Do not claim deployment unless an actual static host was configured and verified.

---

## Implementation Completion Conditions

- All twelve task review checkpoints are complete.
- `npm run verify` passes.
- Three physical exhibit routes and three share cards exist in the production output.
- Homepage contains no canvas; exhibit pages contain at most one canvas.
- Native sharing and clipboard fallback are tested.
- Audio begins only after opt-in.
- Model, WebGL, empty catalog, and not-found fallbacks remain readable.
- Task-owned Vite and browser-automation processes are stopped.
- No Git commit or push occurs without explicit user authorization.
