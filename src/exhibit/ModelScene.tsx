import { Bounds, OrbitControls, useGLTF } from "@react-three/drei"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import {
  Suspense,
  type ComponentRef,
  type MutableRefObject,
  type Ref,
  type ReactNode,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  DataTexture,
  Box3,
  InstancedMesh,
  Group,
  Material,
  MathUtils,
  Mesh,
  Object3D,
  ShaderMaterial,
  SkinnedMesh,
  Source,
  Texture,
  Vector3,
  type BufferGeometry,
  type OrthographicCamera,
  type PerspectiveCamera,
} from "three"
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js"
import type { CameraPreset, Exhibit, LightingPresetId } from "../content/types"
import { AnimationController, type AnimationControlsState } from "./AnimationController"
import { DisplayPlinth, DISPLAY_PLINTH_TOP_Y } from "./DisplayPlinth"
import { LightingRig } from "./LightingRig"
import { SceneEnvironment } from "./SceneEnvironment"
import type { SceneProfile } from "./sceneProfiles"
import { usePerformanceTier } from "./usePerformanceTier"

export type ModelControlsHandle = {
  resetCamera(): void
}

type ModelSceneProps = {
  model: string
  profile: SceneProfile
  camera: CameraPreset
  frameScale?: number
  lightingPreset: LightingPresetId
  animation?: Exhibit["animation"]
  onAnimationControlsChange?(state: AnimationControlsState): void
  onReady(): void
  controlsRef?: Ref<ModelControlsHandle>
}

function cloneTexture(source: Texture, textureClones: Map<Texture, Texture>): Texture {
  const existing = textureClones.get(source)
  if (existing) return existing

  const ownedTexture = source.clone()
  if (source instanceof DataTexture && ownedTexture instanceof DataTexture) {
    const sourceData = source.image.data
    const ownedSource = new Source({
      ...source.image,
      data: sourceData ? sourceData.slice() : null,
    })
    ownedSource.dataReady = source.source.dataReady
    ownedTexture.source = ownedSource
  }
  ownedTexture.needsUpdate = true
  textureClones.set(source, ownedTexture)
  return ownedTexture
}

function cloneTextureSlots(
  sourceValue: unknown,
  ownedValue: unknown,
  textureClones: Map<Texture, Texture>,
  containerClones: WeakMap<object, unknown>,
): unknown {
  if (sourceValue instanceof Texture) return cloneTexture(sourceValue, textureClones)

  if (Array.isArray(sourceValue)) {
    const existing = containerClones.get(sourceValue)
    if (existing) return existing

    const ownedArray = Array.isArray(ownedValue) ? ownedValue : []
    const clonedArray: unknown[] = []
    containerClones.set(sourceValue, clonedArray)
    sourceValue.forEach((value, index) => {
      clonedArray[index] = cloneTextureSlots(
        value,
        ownedArray[index],
        textureClones,
        containerClones,
      )
    })
    return clonedArray
  }

  if (isPlainObject(sourceValue)) {
    const existing = containerClones.get(sourceValue)
    if (existing) return existing

    const ownedRecord = isPlainObject(ownedValue) ? ownedValue : {}
    const clonedRecord: Record<string, unknown> = Object.create(Object.getPrototypeOf(sourceValue))
    containerClones.set(sourceValue, clonedRecord)
    for (const [property, value] of Object.entries(sourceValue)) {
      clonedRecord[property] = cloneTextureSlots(
        value,
        ownedRecord[property],
        textureClones,
        containerClones,
      )
    }
    return clonedRecord
  }

  return ownedValue ?? sourceValue
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function cloneMaterialTextures(
  source: Material,
  owned: Material,
  textureClones: Map<Texture, Texture>,
  containerClones: WeakMap<object, unknown>,
) {
  const sourceValues = source as unknown as Record<string, unknown>
  const ownedValues = owned as unknown as Record<string, unknown>

  for (const [property, sourceValue] of Object.entries(sourceValues)) {
    if (source instanceof ShaderMaterial && property === "uniforms") continue
    const clonedValue = cloneTextureSlots(
      sourceValue,
      ownedValues[property],
      textureClones,
      containerClones,
    )
    if (clonedValue !== ownedValues[property]) ownedValues[property] = clonedValue
  }

  if (source instanceof ShaderMaterial && owned instanceof ShaderMaterial) {
    for (const [name, sourceUniform] of Object.entries(source.uniforms)) {
      const ownedUniform = owned.uniforms[name]
      if (!ownedUniform) continue
      ownedUniform.value = cloneTextureSlots(
        sourceUniform.value,
        ownedUniform.value,
        textureClones,
        containerClones,
      )
    }
  }
}

export function cloneOwnedScene<T extends Object3D>(scene: T): T {
  // SkeletonUtils preserves the concrete Object3D subtype at runtime, but its
  // declaration intentionally returns the base Object3D type.
  const ownedScene = cloneSkeleton(scene) as T
  const textureClones = new Map<Texture, Texture>()
  const containerClones = new WeakMap<object, unknown>()
  const sourceMeshes: Mesh[] = []
  const ownedMeshes: Mesh[] = []
  scene.traverse((object) => {
    if (object instanceof Mesh) sourceMeshes.push(object)
  })
  ownedScene.traverse((object) => {
    if (object instanceof Mesh) ownedMeshes.push(object)
  })

  ownedMeshes.forEach((object, index) => {
    const sourceObject = sourceMeshes[index]!

    object.geometry = object.geometry.clone()
    const sourceMaterials = Array.isArray(sourceObject.material)
      ? sourceObject.material
      : [sourceObject.material]
    const ownedMaterials = sourceMaterials.map((sourceMaterial) => {
      const ownedMaterial = sourceMaterial.clone()
      cloneMaterialTextures(sourceMaterial, ownedMaterial, textureClones, containerClones)
      return ownedMaterial
    })
    object.material = Array.isArray(object.material) ? ownedMaterials : ownedMaterials[0]!

    if (
      sourceObject instanceof SkinnedMesh &&
      object instanceof SkinnedMesh &&
      sourceObject.skeleton.boneTexture
    ) {
      const boneTexture = cloneTexture(sourceObject.skeleton.boneTexture, textureClones)
      if (boneTexture instanceof DataTexture) {
        object.skeleton.boneTexture = boneTexture
        if (boneTexture.image.data instanceof Float32Array) {
          object.skeleton.boneMatrices = boneTexture.image.data
        }
      }
    }

    if (
      sourceObject instanceof InstancedMesh &&
      object instanceof InstancedMesh &&
      sourceObject.morphTexture
    ) {
      const morphTexture = cloneTexture(sourceObject.morphTexture, textureClones)
      if (morphTexture instanceof DataTexture) object.morphTexture = morphTexture
    }
  })

  return ownedScene
}

export type ModelFrameConstraints = {
  maxWidth: number
  maxHeight: number
}

export function resolveModelFrame(
  camera: CameraPreset,
  viewport: { width: number; height: number },
  mobile: boolean,
  frameScale = 1,
): ModelFrameConstraints {
  const width = Math.max(1, viewport.width)
  const height = Math.max(1, viewport.height)
  const aspect = width / height
  const cameraPosition = new Vector3(...camera.position)
  const target = new Vector3(...camera.target)
  const distance = Math.max(0.01, cameraPosition.distanceTo(target))
  const visibleHeight = 2 * distance * Math.tan((42 * Math.PI) / 360)
  // Perspective depth and the offset camera make a target-plane width project
  // larger than the same fraction on screen. Keep desktop horizontal models
  // inside the frustum while reserving a substantial majority of the stage.
  const widthFill = mobile ? 0.82 : 0.64
  const heightFill = mobile ? 0.72 : 0.76

  return {
    maxWidth: visibleHeight * aspect * widthFill * frameScale,
    maxHeight: visibleHeight * heightFill * frameScale,
  }
}

export function normalizeOwnedScene<T extends Object3D>(
  scene: T,
  target: number | ModelFrameConstraints = 2.2,
): T {
  let bounds = new Box3().setFromObject(scene)
  let size = bounds.getSize(new Vector3())
  if (size.z > Math.max(size.x, size.y) * 1.35) {
    scene.rotateY(Math.PI / 2)
    scene.updateMatrixWorld(true)
    bounds = new Box3().setFromObject(scene)
    size = bounds.getSize(new Vector3())
  }
  const frame =
    typeof target === "number" ? { maxWidth: target, maxHeight: target } : target
  const widthScale = size.x > 0 ? frame.maxWidth / size.x : Infinity
  const heightScale = size.y > 0 ? frame.maxHeight / size.y : Infinity
  const scale = Math.min(widthScale, heightScale)
  if (!Number.isFinite(scale) || scale <= 0) return scene

  if (Math.abs(scale - 1) > 1e-10) scene.scale.multiplyScalar(scale)
  scene.updateMatrixWorld(true)
  const finalCenter = new Box3().setFromObject(scene).getCenter(new Vector3())
  if (finalCenter.lengthSq() > 1e-20) {
    const centerInParent = scene.parent
      ? scene.parent.worldToLocal(finalCenter.clone())
      : finalCenter
    scene.position.sub(centerInParent)
    scene.updateMatrixWorld(true)
  }
  return scene
}

export function placeOwnedSceneOnPlinth<T extends Object3D>(scene: T, topY: number): T {
  scene.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(scene)
  if (!Number.isFinite(bounds.min.y)) return scene

  scene.position.y += topY - bounds.min.y
  scene.updateMatrixWorld(true)
  return scene
}

export function resolveCenteredPlinthTopY(
  scene: Object3D,
  baseTopY: number,
  viewerCenterY: number,
): number {
  scene.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(scene)
  const height = bounds.max.y - bounds.min.y
  if (!Number.isFinite(height) || height <= 0) return baseTopY

  return Math.max(baseTopY, viewerCenterY - height / 2)
}

export function resolvePointerTilt(
  pointer: readonly [number, number],
  reducedMotion: boolean,
): [number, number] {
  if (reducedMotion) return [0, 0]
  return [-pointer[1] * 0.045, pointer[0] * 0.065]
}

function collectTextureSlots(
  value: unknown,
  textures: Set<Texture>,
  visited: WeakSet<object>,
) {
  if (value instanceof Texture) {
    textures.add(value)
    return
  }
  if (!Array.isArray(value) && !isPlainObject(value)) return
  if (visited.has(value)) return
  visited.add(value)

  const children = Array.isArray(value) ? value : Object.values(value)
  for (const child of children) collectTextureSlots(child, textures, visited)
}

function materialTextures(material: Material): Texture[] {
  const textures = new Set<Texture>()
  const visited = new WeakSet<object>()
  for (const value of Object.values(material)) collectTextureSlots(value, textures, visited)
  return [...textures]
}

export function disposeOwnedScene(scene: Object3D) {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const textures = new Set<Texture>()

  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return
    geometries.add(object.geometry)
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of meshMaterials) {
      materials.add(material)
      for (const texture of materialTextures(material)) textures.add(texture)
    }
    if (object instanceof SkinnedMesh && object.skeleton.boneTexture) {
      textures.add(object.skeleton.boneTexture)
    }
    if (object instanceof InstancedMesh && object.morphTexture) {
      textures.add(object.morphTexture)
    }
  })

  for (const texture of textures) texture.dispose()
  for (const material of materials) material.dispose()
  for (const geometry of geometries) geometry.dispose()
}

type CameraControlsProps = {
  cameraPreset: CameraPreset
  controlsRef?: Ref<ModelControlsHandle>
  draggingRef: MutableRefObject<boolean>
}

type PresetCamera = PerspectiveCamera | OrthographicCamera

type PresetControls = {
  target: { set(x: number, y: number, z: number): unknown }
  minDistance: number
  maxDistance: number
  update(): void
}

export function applyCameraPreset(
  camera: PresetCamera,
  controls: PresetControls,
  preset: CameraPreset,
) {
  camera.position.set(...preset.position)
  controls.target.set(...preset.target)
  controls.minDistance = preset.minDistance
  controls.maxDistance = preset.maxDistance
  camera.lookAt(...preset.target)
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()
  controls.update()
}

function CameraControls({ cameraPreset, controlsRef, draggingRef }: CameraControlsProps) {
  const orbitControls = useRef<ComponentRef<typeof OrbitControls>>(null)

  useImperativeHandle(
    controlsRef,
    () => ({
      resetCamera() {
        const controls = orbitControls.current
        if (controls) applyCameraPreset(controls.object, controls, cameraPreset)
      },
    }),
    [cameraPreset],
  )

  useLayoutEffect(() => {
    const controls = orbitControls.current
    if (controls) applyCameraPreset(controls.object, controls, cameraPreset)
  }, [cameraPreset])

  return (
    <OrbitControls
      ref={orbitControls}
      makeDefault
      enableDamping
      minDistance={cameraPreset.minDistance}
      maxDistance={cameraPreset.maxDistance}
      minPolarAngle={0.12}
      maxPolarAngle={Math.PI * 0.88}
      target={cameraPreset.target}
      onStart={() => {
        draggingRef.current = true
      }}
      onEnd={() => {
        draggingRef.current = false
      }}
    />
  )
}

function PointerTiltGroup({
  children,
  draggingRef,
}: {
  children: ReactNode
  draggingRef: MutableRefObject<boolean>
}) {
  const group = useRef<Group>(null)
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  )

  useFrame((state, delta) => {
    const target = resolvePointerTilt([state.pointer.x, state.pointer.y], reducedMotion)
    const modelGroup = group.current
    if (!modelGroup || draggingRef.current) return
    modelGroup.rotation.x = MathUtils.damp(modelGroup.rotation.x, target[0], 7, delta)
    modelGroup.rotation.y = MathUtils.damp(modelGroup.rotation.y, target[1], 7, delta)
  })

  return <group ref={group}>{children}</group>
}

type OwnedModelProps = {
  model: string
  frame: ModelFrameConstraints
  viewerCenterY?: number
  plinthTopY?: number
  draggingRef?: MutableRefObject<boolean>
  animation?: Exhibit["animation"]
  onAnimationControlsChange?(state: AnimationControlsState): void
  onReady(): void
}

export function OwnedModel({
  model,
  frame,
  viewerCenterY = 0,
  plinthTopY = DISPLAY_PLINTH_TOP_Y,
  draggingRef,
  animation,
  onAnimationControlsChange,
  onReady,
}: OwnedModelProps) {
  const { scene, animations } = useGLTF(model)
  const ownedScene = useMemo(() => cloneOwnedScene(scene), [scene])
  const readyScene = useRef<Object3D | null>(null)
  const [resolvedPlinthTopY, setResolvedPlinthTopY] = useState(plinthTopY)

  useLayoutEffect(() => {
    normalizeOwnedScene(ownedScene, frame)
    const nextPlinthTopY = resolveCenteredPlinthTopY(
      ownedScene,
      plinthTopY,
      viewerCenterY,
    )
    placeOwnedSceneOnPlinth(ownedScene, nextPlinthTopY)
    setResolvedPlinthTopY(nextPlinthTopY)
  }, [frame.maxHeight, frame.maxWidth, ownedScene, plinthTopY, viewerCenterY])

  useLayoutEffect(() => {
    ownedScene.traverse((object) => {
      if (object instanceof Mesh) object.castShadow = true
    })
  }, [ownedScene])

  useEffect(() => () => disposeOwnedScene(ownedScene), [ownedScene])

  useEffect(() => {
    if (readyScene.current === ownedScene) return
    readyScene.current = ownedScene
    onReady()
  }, [onReady, ownedScene])

  return (
    <>
      <DisplayPlinth topY={resolvedPlinthTopY} />
      {draggingRef ? (
        <PointerTiltGroup draggingRef={draggingRef}>
          <primitive object={ownedScene} />
        </PointerTiltGroup>
      ) : (
        <primitive object={ownedScene} />
      )}
      <AnimationController
        animations={animations}
        scene={ownedScene}
        animation={animation}
        onChange={onAnimationControlsChange}
      />
    </>
  )
}

function FramedOwnedModel({
  camera,
  frameScale,
  mobile,
  ...props
}: Omit<OwnedModelProps, "frame" | "viewerCenterY"> & {
  camera: CameraPreset
  frameScale?: number
  mobile: boolean
}) {
  const size = useThree((state) => state.size)
  const frame = useMemo(
    () => resolveModelFrame(camera, size, mobile, frameScale),
    [camera, frameScale, mobile, size.height, size.width],
  )

  return <OwnedModel {...props} frame={frame} viewerCenterY={camera.target[1]} />
}

export function ModelScene({
  model,
  profile,
  camera,
  frameScale,
  lightingPreset,
  animation,
  onAnimationControlsChange,
  onReady,
  controlsRef,
}: ModelSceneProps) {
  const performance = usePerformanceTier(profile)
  const draggingRef = useRef(false)

  return (
    <Canvas
      camera={{ position: [...camera.position], fov: 42, near: 0.05, far: 100 }}
      dpr={performance.dpr}
      shadows={performance.shadows}
      gl={{
        alpha: true,
        antialias: !performance.mobile,
        powerPreference: performance.mobile ? "low-power" : "high-performance",
      }}
      onCreated={({ camera: canvasCamera }) => canvasCamera.lookAt(...camera.target)}
    >
      <SceneEnvironment profile={profile} shadows={performance.shadows} />
      <LightingRig preset={lightingPreset} />
      <Suspense fallback={null}>
        <Bounds observe margin={1.2}>
          <FramedOwnedModel
            model={model}
            camera={camera}
            frameScale={frameScale}
            mobile={performance.mobile}
            animation={animation}
            onAnimationControlsChange={onAnimationControlsChange}
            onReady={onReady}
            draggingRef={draggingRef}
          />
        </Bounds>
      </Suspense>
      <CameraControls
        cameraPreset={camera}
        controlsRef={controlsRef}
        draggingRef={draggingRef}
      />
    </Canvas>
  )
}
