# Atmospheric gallery redesign specification

## Goal

Turn the existing digital-figure gallery into a borderless, cinematic collection space where each model remains fully visible, sits on a wooden display plinth, and receives an exhibit-specific atmosphere derived from its dominant colors.

## Approved direction

- Detail layout: full-viewport, borderless stage; the normal site header and footer disappear on exhibit routes.
- Copy treatment: option C, “breathing annotation.” The title stays visible beside the model; summary and metadata become clearer and slightly larger on hover/focus. Mobile uses an explicit details toggle so information is discoverable without covering the model.
- Background: option C, “edge bloom.” A near-black base carries slowly drifting vertical light folds. Two or three exhibit colors tint the folds, and the strongest restrained bloom gathers along the lower-right edge.
- Pedestal: a site-owned wooden plinth is the default, with the data model able to opt into a future exhibit-specific plinth.
- Model interaction: left-drag/touch orbit, wheel/pinch zoom, right-drag pan, reset control, plus restrained pointer-follow tilt when the pointer is merely moving over the stage.
- Homepage: pre-rendered high-resolution exhibit images, not three live WebGL canvases. Every cover shows the same model-and-plinth visual language, and links use route view transitions where supported.
- Music: use the user-provided `esmifiesta - Felicia Morales - Merry Christmas Mr Lawrence.mp3` as the opt-in theme track. Keep autoplay disabled until the visitor explicitly enables sound.
- Variance: shared interaction and accessibility rules are consistent, but palette, fold placement, lighting, camera, and future pedestal overrides remain exhibit-owned data.
- Audio mixing: the theme continues throughout the site. Exhibits without ambience keep the theme at a reduced level; exhibits with ambience retain the theme at roughly 12% beneath ambience at roughly 45%.
- Homepage atmosphere: one restrained, stable collection-room background; exhibit-specific palettes stay inside each cover.
- Detail variance: three layout families remain available — central shrine, offset narrative, and immersive banner — while sharing the borderless stage and breathing-annotation rules.
- Mobile disclosure: collapsed title/control at the bottom; expanded translucent copy is scrollable and capped at 38dvh.
- Motion language: use spatially continuous shared-element transitions with a soft cover-to-WebGL crossfade, spring-like cubic Bézier timing, no abrupt wipes, and a reduced-motion fallback. The target feeling is Apple-like continuity, not imitation of proprietary assets.

## Visual system

- Base: `#070806` carbon black, never pure black.
- Paper: `#f2e8da` warm ivory.
- Utility: `#b9aa9d` softened warm gray.
- Wood: `#6b4226` walnut and `#c58b52` edge highlight.
- Signature: per-exhibit light curtains and edge bloom, not cards, borders, or generic gradients.
- Typography: retain Songti-family display type for the Chinese museum voice and PingFang/system sans for controls; reduce detail display scale so the model remains the focal point.

## Exhibit palette contract

`presentation.palette` contains exactly three valid CSS hex colors: `[shadow, primary, accent]`. The current exhibits use manually derived values; the future Blender export workflow must provide the same field. Runtime rendering does not sample pixels from a GLB on every visit.

## Responsive and accessibility rules

- Stage uses `min-height: 100dvh`; no fixed viewport height that breaks mobile browser chrome.
- Model canvas and atmosphere never sit underneath a large permanent information panel.
- Every control has a visible focus state and at least a 44px mobile hit target.
- Reduced-motion mode freezes light folds, removes pointer-follow tilt, and disables view-transition choreography.
- The low-resolution cover is removed once the model is ready and can never remain as an opaque lower layer.
- Navigation transitions preserve the apparent position and scale of the selected exhibit instead of cutting to an unrelated composition.
- A useful image fallback, status announcement, and model retry control remain available.

## Non-goals

- Do not rename the site in this pass.
- Do not add a CMS, server, database, authentication, or new UI framework.
- Do not replace the existing Three.js/React Three Fiber stack.
- Do not auto-play copyrighted audio without user activation.
