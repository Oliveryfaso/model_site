# Digital Figure Gallery — Design Specification

**Date:** 2026-08-30
**Status:** Approved design; implementation plan not yet written
**Project directory:** `/Volumes/KINGSTON/idea/digital-figure-gallery`
**Brand name:** Intentionally deferred. The implementation must keep the displayed site title configurable rather than hard-code a temporary brand.

## 1. Product Summary

Build a public, atmospheric website for collecting and appreciating digital figurines and character models. The collection will initially contain 6–12 GLB assets created in Blender or sourced from elsewhere. The owner curates all content through local files and a typed content file; visitors do not create accounts or upload content.

The experience has two complementary modes:

1. A visually cohesive collection homepage with one featured exhibit and an editorial collection wall.
2. Individual interactive 3D exhibit pages whose composition, scene, lighting, animation, and ambience can vary by item without becoming separate one-off applications.

The site is Chinese-first, with selective English labels such as archive terminology or collection identifiers where they strengthen the digital-collection character.

## 2. Goals

- Present 6–12 diverse character models as a curated digital collection.
- Let visitors rotate, zoom, reset, and view models fullscreen.
- Give exhibits distinct atmospheres through reusable layouts and scene profiles.
- Support optional model animations without making animation a content requirement.
- Support an optional sound experience that begins only after explicit user action.
- Give every exhibit a stable public URL that opens the full interactive experience.
- Produce a unique link-preview card for every exhibit using its cover, name, and summary.
- Remain usable on mobile devices and when WebGL or model loading fails.
- Allow a new exhibit to be added by copying assets and adding one typed configuration entry.
- Deploy as static files without a database or long-running application server.

## 3. Non-Goals for Version 1

- User accounts, login, comments, likes, or personal favorites
- User uploads or an administrative interface
- Online conversion of Blend, FBX, OBJ, or other formats
- Search, category filters, or a large-collection information architecture
- Model downloads
- CMS integration or cloud asset management
- VR or AR modes
- Professional material-editing controls
- Automatically generated share posters
- Full bilingual localization
- Display of author, source, or license information

Attribution fields are reserved in the data model but remain optional and hidden. Public deployment does not remove the owner's responsibility to use assets they are permitted to publish.

## 4. Information Architecture

The public site has three route types:

```text
/                       Collection homepage
/exhibits/:slug/        Individual exhibit
/about/                 Short collection statement
```

The homepage displays every exhibit because the initial collection is small. Tags communicate subject or style but do not act as filters in version 1.

Unknown exhibit slugs render a designed not-found state with a route back to the collection. Direct navigation to a generated exhibit URL must work without server-side rewrite rules.

## 5. Visual Direction

The baseline personality is a warm, private collection cabinet: deep wood tones, amber light, soft shadow, and restrained editorial typography. This identity governs navigation, collection labels, page rhythm, and transitions; it must not force every exhibit into the same visual scene.

### 5.1 Homepage Composition

The homepage uses a **featured exhibit plus collection wall** layout:

- One large featured cover, collection number, name, short summary, and entry action
- An asymmetric editorial grid of the remaining exhibit covers
- A compact collection statement and link to the About page
- A global sound toggle in the shared navigation

Homepage cards contain:

- Cover image
- Collection number
- Character name
- One-sentence summary
- Two or three tags
- A subtle marker when animation is available

The homepage never loads GLB files. Hover and focus treatments use restrained depth, light, and text motion instead of embedded 3D previews.

### 5.2 Exhibit Layout Profiles

Each exhibit chooses one reusable page composition:

1. **Center Stage** — a centered model with a lower-corner information card; default for humanoid characters.
2. **Story Offset** — an offset model balanced by a more prominent story panel.
3. **Immersive** — environment-first composition with details in an expandable panel.

Navigation, interaction semantics, collection labels, sharing, and audio state remain consistent across all three layouts.

### 5.3 Scene Profiles

Version 1 provides three reusable scene profiles:

1. **Warm Cabinet** — wood alcove, warm pedestal, amber highlights.
2. **Star Mist** — dark violet space, light fog or low-cost particles, cool rim light.
3. **Cold Chamber** — blue-white chamber, restrained grid or scan motif, crisp top light.

An exhibit combines a layout profile and scene profile, then optionally overrides allowed background color, camera preset, and lighting choices. The visitor cannot edit arbitrary rendering parameters.

## 6. Technical Architecture

Use a static React application built with:

- Vite
- React and TypeScript
- React Router
- Three.js through React Three Fiber
- Reusable React Three Fiber helpers where they reduce custom scene code
- Browser audio APIs or HTML audio elements behind one application-level audio controller

No runtime backend, database, authentication, or server-side rendering is required.

### 6.1 Application Boundaries

```text
ApplicationShell
├── Router
├── SiteNavigation
├── GlobalAudioController
├── CollectionPage
│   ├── FeaturedExhibit
│   └── CollectionWall
├── ExhibitPage
│   ├── ExhibitInformation
│   ├── ModelExperience
│   │   ├── SceneProfile
│   │   ├── ModelLoader
│   │   ├── CameraControls
│   │   ├── LightingPresets
│   │   └── AnimationControls
│   └── ExhibitToolbar
├── AboutPage
└── ErrorBoundariesAndFallbacks
```

The 3D module owns scene resources and cleanup. The application shell owns route-level audio state so sound can crossfade instead of restarting abruptly during navigation.

### 6.2 Static Share-Page Generation

The Vite build includes a small project-owned generation step. It reads the same typed exhibit data used by React and emits a static HTML entry for each public route:

```text
dist/
├── index.html
├── about/index.html
└── exhibits/
    ├── example-one/index.html
    └── example-two/index.html
```

Each exhibit HTML entry contains:

- Unique document title
- Exhibit summary
- Canonical URL
- Open Graph title, description, image, and URL
- A reference to the shared React application bundle

Opening the link loads the complete interactive exhibit, not a reduced preview. Static route files avoid reliance on hosting-provider rewrite rules. The public origin is supplied as a build configuration value so generated canonical and share URLs are absolute.

## 7. Content and Asset Structure

```text
public/
├── models/
├── covers/
├── share/
└── audio/

src/
├── content/
│   └── exhibits.ts
├── scenes/
├── components/
├── pages/
├── audio/
└── styles/
```

Only GLB is supported at runtime. Other formats must be converted and optimized before being added to the site.

### 7.1 Exhibit Schema

```ts
type Exhibit = {
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
    layout: "center-stage" | "story-offset" | "immersive"
    scene: "warm-cabinet" | "star-mist" | "cold-chamber"
    background?: string
    camera?: CameraPreset
    lightingPresets: LightingPreset[]
  }

  animation?: {
    mode: "static" | "autoplay" | "manual"
    clip?: string
  }

  audio?: {
    ambientTrack: string
  }

  share?: {
    title?: string
    description?: string
    image?: string
  }

  attribution?: {
    creator?: string
    source?: string
    license?: string
  }
}
```

Share values default to the exhibit title, summary, and cover. Explicit `share` values override those defaults.

### 7.2 Build-Time Validation

The build fails for data errors that would create broken public pages:

- Duplicate slugs or collection numbers
- Missing required title, summary, cover, or model paths
- Unknown layout, scene, or lighting identifiers
- Multiple featured exhibits when exactly one is expected

The build warns, rather than fails, when an asset exceeds a performance budget. Animation clip existence is checked at runtime after the GLB is loaded; an invalid optional clip falls back to a static presentation and reports a development warning.

## 8. 3D Interaction

Default model interaction includes:

- Slow idle rotation when appropriate
- Pointer or touch drag to rotate
- Wheel or pinch to zoom within curated limits
- Reset camera
- Fullscreen presentation
- Switch between exhibit-approved lighting presets
- Play or pause animation only when the exhibit exposes an animation control

Lighting controls use named artistic presets, not raw sliders for intensity, roughness, metalness, or color. Camera limits prevent visitors from losing the model or clipping deeply through it.

Changing exhibits disposes the previous model, materials, textures, animation mixer, and render-loop subscriptions before the new exhibit becomes active.

## 9. Animation Behavior

Animation is optional and is not a sourcing requirement.

- `static`: no animation control is rendered.
- `autoplay`: a configured animation begins after model readiness and loops according to its exhibit configuration.
- `manual`: the model starts still and exposes a play/pause control.

If an exhibit has no animation clips, no animation UI appears. The collection-card animation marker is derived from valid exhibit configuration, not inferred from file naming.

## 10. Audio Behavior

Audio is muted on a visitor's first use. Playback can begin only after an explicit visitor action.

```text
Muted first visit
  → visitor enables sound
  → collection theme starts
  → enter exhibit with ambience
  → collection theme crossfades to exhibit track
  → return to collection
  → exhibit track crossfades back to collection theme
```

Only one principal track plays at a time. If an exhibit has no ambient track, the collection theme continues at a reduced volume. Crossfades last approximately one second and can be tuned during visual and audio QA.

The sound preference is stored locally in the browser. Browser autoplay restrictions always take precedence. Audio pauses while the document is hidden and resumes only when consistent with the visitor's stored setting and browser permission.

Model ambience is not loaded before the model is ready, and audio failure never prevents visual content from loading.

## 11. Sharing

Every exhibit toolbar includes a Share action.

1. Use the native system share mechanism when it is supported and the page is running in a secure context.
2. Otherwise copy the canonical exhibit URL and show clear success feedback.

The shared URL opens the full exhibit without login. Chat and social preview crawlers receive the exhibit-specific static metadata generated at build time.

Version 1 does not generate downloadable share posters.

## 12. Loading, Error, and Empty States

### 12.1 Exhibit Loading

- Show the exhibit cover immediately.
- Show the title and a restrained progress indicator.
- Dynamically load the 3D application code and current GLB.
- Fade the model over the cover only after the initial scene is ready.
- Load optional audio only after the visitor has enabled sound.

### 12.2 Model Failure

- Preserve the cover, title, description, tags, and share action.
- Show a concise failure message and a retry action.
- Do not treat a 3D failure as a page-level failure.

### 12.3 WebGL Unavailable

Render a static exhibit experience using the cover and full written content. Explain that interactive 3D is unavailable without blocking navigation or sharing.

### 12.4 Collection and Route Errors

- A zero-exhibit dataset renders a designed empty collection state.
- An invalid exhibit URL renders the designed not-found page.
- Missing nonessential audio or optional animation falls back silently in production and warns during development.

## 13. Responsive and Accessible Behavior

- The homepage editorial grid collapses into a readable single-column sequence on narrow screens.
- Exhibit pages stack the viewer and information rather than use a brittle fixed-height desktop composition.
- Secondary controls move into a mobile bottom sheet so they do not cover the model.
- Core actions remain keyboard reachable with visible focus treatment.
- Buttons have text or accessible names; icons alone are not relied upon.
- Touch targets are sized for mobile use.
- Reduced-motion preference disables decorative movement and minimizes nonessential transitions.
- Sound never begins automatically on a first visit.
- Static cover and text remain meaningful when the canvas is unavailable to assistive technology.

## 14. Performance Budgets and Loading Strategy

Project targets:

| Asset | Target | Budget Behavior |
|---|---:|---|
| GLB | 15 MB or less | Warn above 25 MB |
| Individual model texture | Usually 2K or less | Prefer compressed mobile-compatible delivery |
| Homepage cover | 300 KB or less | Generate WebP or AVIF |
| Share image | Approximately 1200×630 | Optimize separately from source art |
| Exhibit ambience | Approximately 3 MB | Compress and defer loading |

The homepage loads only images in or near the viewport. Three.js and exhibit code are route-split and loaded only when entering an exhibit. Only the current GLB is active.

Mobile capability adjustments may reduce device pixel ratio, shadow resolution, particle count, post-processing, and simultaneous lights. Basic lighting and model controls remain available.

## 15. Validation Strategy

### 15.1 Automated Checks

- Type checking and production build
- Exhibit-data validation
- Static route and metadata generation
- Unique slug and collection-number enforcement
- Route rendering for collection, exhibit, About, not-found, and empty states
- Audio state transitions independent of actual playback permission
- Scene-profile and lighting-preset selection

### 15.2 Browser and Interaction Checks

- Desktop, tablet, and mobile layout
- Direct navigation to every generated exhibit URL
- Native share path and copy-link fallback
- Mouse, touch, and keyboard interaction
- Model success, failure, retry, and WebGL fallback
- Static, single-animation, and multi-animation sample models
- Sound opt-in, crossfade, page visibility pause, and return behavior
- Reduced-motion behavior
- Fullscreen entry and exit

### 15.3 Visual and Performance Checks

Use at least three differently proportioned sample assets: a tall humanoid, a broad mechanical character, and a horizontally composed character or creature. Verify camera framing and information-panel overlap for all layout profiles.

Repeatedly navigate through multiple exhibits and confirm that animation loops, event listeners, GPU resources, and audio nodes do not accumulate. Test under throttled network conditions and with mobile performance settings.

## 16. Deployment

The production build is provider-neutral static output. A static host must support HTTPS, correct MIME types for GLB and audio assets, and suitable cache headers for hashed application assets.

The deployment origin is provided at build time for canonical and Open Graph URLs. Every generated route is represented by a physical `index.html`, so shared links do not depend on SPA rewrite configuration.

## 17. Version 1 Acceptance Criteria

The first version is complete when:

1. The homepage presents one featured exhibit and all remaining exhibits without loading their GLBs.
2. At least three sample exhibits demonstrate distinct layout and scene combinations.
3. Each exhibit supports configured model controls, lighting presets, optional animation, and optional ambience.
4. First-visit audio is muted, opt-in persists locally, and route changes crossfade correctly.
5. Every exhibit has a direct static URL and unique share metadata.
6. Share uses the native mechanism where available and copy-link otherwise.
7. Loading, model failure, WebGL fallback, empty collection, and unknown route states are usable.
8. Mobile layout, touch controls, keyboard access, and reduced-motion behavior are verified.
9. Production build, type checks, data validation, route generation, and targeted browser smoke checks pass.
10. Adding a normal exhibit requires only copying assets and adding one content entry; it does not require a new page component.

## 18. Deferred Decisions

The public brand name and final logo are deliberately deferred until the implemented visual system can be judged in context. This does not block architecture or implementation because the site title, short description, and logo asset are configuration values.

The final static hosting provider is also deferred. The build output remains provider-neutral, and provider selection will be handled as a deployment decision rather than an application-architecture dependency.
