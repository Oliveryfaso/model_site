import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  Box3,
  BoxGeometry,
  Bone,
  DataTexture,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  Skeleton,
  SkinnedMesh,
  Texture,
  Vector3,
} from "three"
import { exhibits } from "../content/exhibits"
import "../styles/exhibit.css"
import { sceneProfiles } from "./sceneProfiles"

const modelSceneState = vi.hoisted(() => ({
  mode: "ready" as "ready" | "error",
  mounts: 0,
  readyCallbacks: [] as Array<() => void>,
}))

const loaderCacheState = vi.hoisted(() => {
  const rejectedModels = new Set<string>()
  return {
    rejectedModels,
    clear: vi.fn((model: string) => rejectedModels.delete(model)),
  }
})

vi.mock("./modelLoaderCache", () => ({
  clearModelLoaderCache: loaderCacheState.clear,
}))

vi.mock("./ModelScene", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ModelScene")>()

  return {
    ...actual,
    ModelScene: ({ model, onReady }: { model: string; onReady(): void }) => {
      modelSceneState.mounts += 1
      modelSceneState.readyCallbacks.push(onReady)
      if (modelSceneState.mode === "error" || loaderCacheState.rejectedModels.has(model)) {
        throw new Error("model failed")
      }

      return <button onClick={onReady}>完成模型加载</button>
    },
  }
})

import {
  applyCameraPreset,
  cloneOwnedScene,
  disposeOwnedScene,
  normalizeOwnedScene,
  placeOwnedSceneOnPlinth,
  resolvePointerTilt,
  resolveModelFrame,
} from "./ModelScene"
import {
  bindModelAttemptCallback,
  ModelExperience,
  type ModelAttemptToken,
} from "./ModelExperience"

const exhibit = exhibits[0]!
const secondExhibit = exhibits[1]!
const thirdExhibit = exhibits[2]!
const originalGetContext = HTMLCanvasElement.prototype.getContext

function enableWebGL() {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ({}),
  ) as unknown as typeof originalGetContext
}

function disableWebGL() {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as typeof originalGetContext
}

function setReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  )
}

describe("ModelExperience", () => {
  beforeEach(() => {
    modelSceneState.mode = "ready"
    modelSceneState.mounts = 0
    modelSceneState.readyCallbacks = []
    loaderCacheState.rejectedModels.clear()
    loaderCacheState.clear.mockClear()
  })

  afterEach(() => {
    cleanup()
    HTMLCanvasElement.prototype.getContext = originalGetContext
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("announces a model failure once without duplicating the page's exhibit copy", () => {
    enableWebGL()
    modelSceneState.mode = "error"
    vi.spyOn(console, "error").mockImplementation(() => undefined)

    render(<ModelExperience exhibit={exhibit} />)

    expect(screen.getByRole("img", { name: `${exhibit.title}封面` })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: exhibit.title })).not.toBeInTheDocument()
    expect(screen.queryByText(exhibit.summary)).not.toBeInTheDocument()
    expect(screen.queryByText(exhibit.description)).not.toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("三维模型加载失败")
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "重新加载模型" })).toBeVisible()
  })

  it("does not mount the 3D subtree when WebGL is unavailable or detection throws", () => {
    disableWebGL()
    const firstRender = render(<ModelExperience exhibit={exhibit} />)

    expect(modelSceneState.mounts).toBe(0)
    expect(screen.getByRole("status")).toHaveTextContent("此设备无法使用三维查看器")

    firstRender.unmount()
    HTMLCanvasElement.prototype.getContext = vi.fn(() => {
      throw new Error("blocked")
    }) as typeof originalGetContext
    render(<ModelExperience exhibit={exhibit} />)

    expect(modelSceneState.mounts).toBe(0)
    expect(screen.getByRole("status")).toHaveTextContent("此设备无法使用三维查看器")
  })

  it("shows the cover first and reveals the model only after readiness", () => {
    enableWebGL()
    const onReady = vi.fn()

    render(<ModelExperience exhibit={exhibit} onReady={onReady} />)

    const experience = screen.getByTestId("model-experience")
    const cover = screen.getByRole("img", { name: `${exhibit.title}封面` })
    const canvasLayer = experience.querySelector<HTMLElement>(".model-experience__canvas")!
    expect(experience).toHaveAttribute("data-model-state", "loading")
    expect(screen.getByRole("status")).toHaveTextContent("正在加载三维模型")
    expect(screen.getAllByRole("status")).toHaveLength(1)
    expect(cover.style.transition).toBe("")
    expect(canvasLayer.style.transition).toBe("")

    fireEvent.click(screen.getByText("完成模型加载"))

    expect(experience).toHaveAttribute("data-model-state", "ready")
    expect(screen.getByRole("status")).toHaveTextContent("三维模型已加载")
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it("keeps the ready cover painted for the soft fade before hiding it", () => {
    enableWebGL()
    setReducedMotion(false)
    render(<ModelExperience exhibit={exhibit} />)
    const cover = screen.getByRole("img", { name: `${exhibit.title}封面` })

    fireEvent.click(screen.getByText("完成模型加载"))

    expect(cover).toHaveAttribute("data-cover-hidden", "false")
    expect(getComputedStyle(cover).display).toBe("block")
    expect(getComputedStyle(cover).opacity).toBe("0")
    expect(getComputedStyle(cover).visibility).toBe("visible")
    expect(getComputedStyle(cover).pointerEvents).toBe("none")

    fireEvent.transitionEnd(cover, { propertyName: "opacity" })

    expect(cover).toHaveAttribute("data-cover-hidden", "true")
    expect(getComputedStyle(cover).display).toBe("none")
    expect(getComputedStyle(cover).visibility).toBe("hidden")
    expect(getComputedStyle(cover).pointerEvents).toBe("none")
  })

  it("immediately hides a ready cover when reduced motion is preferred", () => {
    enableWebGL()
    setReducedMotion(true)
    render(<ModelExperience exhibit={exhibit} />)
    const cover = screen.getByRole("img", { name: `${exhibit.title}封面` })

    fireEvent.click(screen.getByText("完成模型加载"))

    expect(cover).toHaveAttribute("data-cover-hidden", "true")
    expect(getComputedStyle(cover).display).toBe("none")
  })

  it("cleans the pending cover fade when the exhibit changes quickly", () => {
    enableWebGL()
    setReducedMotion(false)
    vi.useFakeTimers()
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1)
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined)
    const view = render(<ModelExperience exhibit={exhibit} />)
    const cover = screen.getByRole("img", { name: `${exhibit.title}封面` })

    fireEvent.click(screen.getByText("完成模型加载"))
    expect(vi.getTimerCount()).toBe(1)

    view.rerender(<ModelExperience exhibit={secondExhibit} />)

    expect(screen.getByRole("img", { name: `${secondExhibit.title}封面` })).toBe(cover)
    expect(cover).toHaveAttribute("data-cover-hidden", "false")
    expect(vi.getTimerCount()).toBe(0)
    fireEvent.transitionEnd(cover, { propertyName: "opacity" })
    expect(cover).toHaveAttribute("data-cover-hidden", "false")
  })

  it("notifies readiness once for each mounted model instance", () => {
    enableWebGL()
    const onReady = vi.fn()
    render(<ModelExperience exhibit={exhibit} onReady={onReady} />)
    const readyTrigger = screen.getByText("完成模型加载")

    fireEvent.click(readyTrigger)
    fireEvent.click(readyTrigger)

    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it("clears the exact rejected loader cache before a fresh retry attempt", () => {
    enableWebGL()
    loaderCacheState.rejectedModels.add(exhibit.model)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    render(<ModelExperience exhibit={exhibit} />)
    const cover = screen.getByRole("img", { name: `${exhibit.title}封面` })

    fireEvent.click(screen.getByRole("button", { name: "重新加载模型" }))

    expect(loaderCacheState.clear).toHaveBeenCalledOnce()
    expect(loaderCacheState.clear).toHaveBeenCalledWith(exhibit.model)
    expect(screen.getByRole("img", { name: `${exhibit.title}封面` })).toBe(cover)
    expect(screen.getByText("完成模型加载")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("正在加载三维模型")
  })

  it("ignores readiness from the previous subtree after retry", () => {
    enableWebGL()
    modelSceneState.mode = "error"
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const onReady = vi.fn()
    render(<ModelExperience exhibit={exhibit} onReady={onReady} />)
    const staleReady = modelSceneState.readyCallbacks.at(-1)!

    modelSceneState.mode = "ready"
    fireEvent.click(screen.getByRole("button", { name: "重新加载模型" }))
    expect(screen.getByRole("status")).toHaveTextContent("正在加载三维模型")

    act(() => staleReady())

    expect(screen.getByRole("status")).toHaveTextContent("正在加载三维模型")
    expect(onReady).not.toHaveBeenCalled()
  })

  it("rejects ready and error callbacks bound to the previous retry attempt", () => {
    const generation = {}
    const firstAttempt: ModelAttemptToken = {
      identity: "figure-a:/models/a.glb",
      generation,
      attempt: 0,
    }
    let activeAttempt = firstAttempt
    let status = "loading"
    const onReady = vi.fn()
    const staleReady = bindModelAttemptCallback(
      () => activeAttempt,
      firstAttempt,
      () => {
        status = "ready"
        onReady()
      },
    )
    const staleError = bindModelAttemptCallback(
      () => activeAttempt,
      firstAttempt,
      () => {
        status = "error"
      },
    )

    activeAttempt = { ...firstAttempt, attempt: 1 }
    staleReady()
    staleError()

    expect(status).toBe("loading")
    expect(onReady).not.toHaveBeenCalled()
  })

  it("treats returning to an exhibit as a new mount after another exhibit fails", () => {
    enableWebGL()
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const onReady = vi.fn()
    const view = render(<ModelExperience exhibit={exhibit} onReady={onReady} />)
    const outerFigure = screen.getByTestId("model-experience")
    const outerCover = screen.getByRole("img", { name: `${exhibit.title}封面` })

    fireEvent.click(screen.getByText("完成模型加载"))
    expect(onReady).toHaveBeenCalledTimes(1)

    modelSceneState.mode = "error"
    view.rerender(<ModelExperience exhibit={secondExhibit} onReady={onReady} />)
    expect(screen.getByTestId("model-experience")).toBe(outerFigure)
    expect(screen.getByRole("img", { name: `${secondExhibit.title}封面` })).toBe(outerCover)
    expect(outerCover).toHaveAttribute("src", secondExhibit.cover)
    expect(screen.queryByRole("heading", { name: secondExhibit.title })).not.toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("三维模型加载失败")

    modelSceneState.mode = "ready"
    view.rerender(<ModelExperience exhibit={exhibit} onReady={onReady} />)
    expect(screen.getByTestId("model-experience")).toBe(outerFigure)
    expect(screen.getByRole("img", { name: `${exhibit.title}封面` })).toBe(outerCover)
    fireEvent.click(screen.getByText("完成模型加载"))

    expect(screen.getByRole("status")).toHaveTextContent("三维模型已加载")
    expect(onReady).toHaveBeenCalledTimes(2)
  })

  it("clears consecutive stale failures when a later exhibit becomes ready", () => {
    enableWebGL()
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    modelSceneState.mode = "error"
    const onReady = vi.fn()
    const view = render(<ModelExperience exhibit={exhibit} onReady={onReady} />)
    expect(screen.getByRole("alert")).toHaveTextContent("三维模型加载失败")

    view.rerender(<ModelExperience exhibit={secondExhibit} onReady={onReady} />)
    expect(screen.getByRole("alert")).toHaveTextContent("三维模型加载失败")

    modelSceneState.mode = "ready"
    view.rerender(<ModelExperience exhibit={thirdExhibit} onReady={onReady} />)
    fireEvent.click(screen.getByText("完成模型加载"))

    expect(screen.getByRole("status")).toHaveTextContent("三维模型已加载")
    expect(onReady).toHaveBeenCalledOnce()
    expect(screen.queryByRole("button", { name: "重新加载模型" })).not.toBeInTheDocument()
  })

  it("treats a model change under the same slug as a new mounted instance", () => {
    enableWebGL()
    const onReady = vi.fn()
    const view = render(<ModelExperience exhibit={exhibit} onReady={onReady} />)
    fireEvent.click(screen.getByText("完成模型加载"))

    view.rerender(
      <ModelExperience
        exhibit={{ ...exhibit, model: secondExhibit.model }}
        onReady={onReady}
      />,
    )
    fireEvent.click(screen.getByText("完成模型加载"))

    expect(onReady).toHaveBeenCalledTimes(2)
  })
})

describe("owned scene resources", () => {
  afterEach(cleanup)

  function makeObjectTexturedScene() {
    const scene = new Scene()
    const boneData = new Float32Array(64)
    const sharedTexture = new DataTexture(boneData, 4, 4)
    const sharedMaterial = new MeshStandardMaterial({ map: sharedTexture })
    const bone = new Bone()
    const skeleton = new Skeleton([bone])
    skeleton.boneTexture = sharedTexture
    skeleton.boneMatrices = boneData

    const skinnedMesh = new SkinnedMesh(new BoxGeometry(), sharedMaterial)
    skinnedMesh.add(bone)
    skinnedMesh.bind(skeleton)

    const instancedMesh = new InstancedMesh(new BoxGeometry(), sharedMaterial, 1)
    instancedMesh.morphTexture = sharedTexture
    const nestedUniform: Record<string, unknown> = {
      direct: sharedTexture,
      layers: [{ texture: sharedTexture }, [sharedTexture]],
    }
    nestedUniform.self = nestedUniform
    const shaderMaterial = new ShaderMaterial({
      uniforms: { nested: { value: nestedUniform } },
    })
    const shaderMesh = new Mesh(new BoxGeometry(), shaderMaterial)
    scene.add(skinnedMesh, instancedMesh, shaderMesh)

    return { scene, sharedTexture, skeleton, nestedUniform }
  }

  it("clones mesh geometry, material, and textures away from cached GLTF resources", () => {
    const sourceScene = new Scene()
    const sourceTexture = new Texture()
    const sourceGeometry = new BoxGeometry()
    const sourceMaterial = new MeshStandardMaterial({ map: sourceTexture })
    sourceScene.add(new Mesh(sourceGeometry, sourceMaterial))

    const ownedScene = cloneOwnedScene(sourceScene)
    const ownedMesh = ownedScene.children[0] as Mesh
    const ownedMaterial = ownedMesh.material as MeshStandardMaterial

    expect(ownedMesh.geometry).not.toBe(sourceGeometry)
    expect(ownedMaterial).not.toBe(sourceMaterial)
    expect(ownedMaterial.map).not.toBe(sourceTexture)
  })

  it("normalizes source-unit scale and centers the owned scene for profile cameras", () => {
    const ownedScene = new Scene()
    const mesh = new Mesh(new BoxGeometry(0.02, 0.06, 0.03), new MeshStandardMaterial())
    mesh.position.set(2, 3, 4)
    ownedScene.add(mesh)

    normalizeOwnedScene(ownedScene)

    const bounds = new Box3().setFromObject(ownedScene)
    const size = bounds.getSize(new Vector3())
    const center = bounds.getCenter(new Vector3())
    expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(2.2)
    expect(center.toArray()).toEqual([0, 0, 0])
  })

  it("centers a translated root from its final world-space bounds", () => {
    const ownedScene = new Scene()
    ownedScene.position.set(7, -3, 5)
    const mesh = new Mesh(new BoxGeometry(2, 4, 1), new MeshStandardMaterial())
    mesh.position.set(2, 1, -4)
    ownedScene.add(mesh)

    normalizeOwnedScene(ownedScene, { maxWidth: 3, maxHeight: 3 })

    const center = new Box3().setFromObject(ownedScene).getCenter(new Vector3())
    expect(center.x).toBeCloseTo(0)
    expect(center.y).toBeCloseTo(0)
    expect(center.z).toBeCloseTo(0)
  })

  it("is repeat-stable when normalized twice with the same frame", () => {
    const ownedScene = new Scene()
    ownedScene.position.set(5, 2, -3)
    ownedScene.add(new Mesh(new BoxGeometry(8, 2, 1), new MeshStandardMaterial()))
    const frame = { maxWidth: 2.4, maxHeight: 2.8 }

    normalizeOwnedScene(ownedScene, frame)
    const firstPosition = ownedScene.position.clone()
    const firstScale = ownedScene.scale.clone()
    const firstRotation = ownedScene.rotation.clone()
    const firstBounds = new Box3().setFromObject(ownedScene)

    normalizeOwnedScene(ownedScene, frame)
    const secondBounds = new Box3().setFromObject(ownedScene)

    expect(ownedScene.position.toArray()).toEqual(firstPosition.toArray())
    expect(ownedScene.scale.toArray()).toEqual(firstScale.toArray())
    expect(ownedScene.rotation.toArray()).toEqual(firstRotation.toArray())
    expect(secondBounds.min.toArray()).toEqual(firstBounds.min.toArray())
    expect(secondBounds.max.toArray()).toEqual(firstBounds.max.toArray())
  })

  it("derives narrower width constraints for a portrait viewer at the same camera", () => {
    const camera = sceneProfiles["star-mist"].defaultCamera
    const portrait = resolveModelFrame(camera, { width: 350, height: 523 }, true)
    const landscape = resolveModelFrame(camera, { width: 1008, height: 560 }, false)

    expect(portrait.maxWidth).toBeLessThan(landscape.maxWidth)
    expect(portrait.maxHeight).toBeLessThan(landscape.maxHeight)
    expect(portrait.maxWidth / portrait.maxHeight).toBeLessThan(1)
    expect(landscape.maxWidth / landscape.maxHeight).toBeGreaterThan(1)
  })

  it("reserves capture overscan on both model-frame axes", () => {
    const frame = resolveModelFrame(
      sceneProfiles["warm-cabinet"].defaultCamera,
      { width: 1600, height: 1200 },
      false,
      0.78,
    )

    expect(frame.maxWidth).toBeCloseTo(2.148631128963384)
    expect(frame.maxHeight).toBeCloseTo(1.9136245992330136)
  })

  it("projects a horizontal model across most of the real wide desktop stage", () => {
    const viewport = { width: 1006, height: 515 }
    const preset = sceneProfiles["star-mist"].defaultCamera
    const horizontal = new Scene()
    horizontal.add(new Mesh(new BoxGeometry(8, 2, 1), new MeshStandardMaterial()))
    normalizeOwnedScene(horizontal, resolveModelFrame(preset, viewport, false))

    const bounds = new Box3().setFromObject(horizontal)
    const camera = new PerspectiveCamera(42, viewport.width / viewport.height, 0.05, 100)
    camera.position.set(...preset.position)
    camera.lookAt(...preset.target)
    camera.updateMatrixWorld()
    camera.updateProjectionMatrix()
    const projectedCorners: Vector3[] = []
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          projectedCorners.push(new Vector3(x, y, z).project(camera))
        }
      }
    }
    const projectedX = projectedCorners.map((corner) => corner.x)
    const projectedY = projectedCorners.map((corner) => corner.y)
    const occupancy = {
      width: (Math.max(...projectedX) - Math.min(...projectedX)) / 2,
      height: (Math.max(...projectedY) - Math.min(...projectedY)) / 2,
    }

    expect(occupancy.width).toBeGreaterThanOrEqual(0.55)
    expect(occupancy.width).toBeLessThanOrEqual(0.75)
    expect(occupancy.height).toBeLessThanOrEqual(0.75)
    expect(Math.min(...projectedX, ...projectedY)).toBeGreaterThanOrEqual(-1)
    expect(Math.max(...projectedX, ...projectedY)).toBeLessThanOrEqual(1)
  })

  it("fits horizontal and vertical models by the constraining screen axis", () => {
    const horizontal = new Scene()
    horizontal.add(new Mesh(new BoxGeometry(8, 2, 1), new MeshStandardMaterial()))
    normalizeOwnedScene(horizontal, { maxWidth: 2.4, maxHeight: 3 })
    const horizontalSize = new Box3().setFromObject(horizontal).getSize(new Vector3())

    const vertical = new Scene()
    vertical.add(new Mesh(new BoxGeometry(1, 8, 1), new MeshStandardMaterial()))
    normalizeOwnedScene(vertical, { maxWidth: 2.4, maxHeight: 3 })
    const verticalSize = new Box3().setFromObject(vertical).getSize(new Vector3())

    expect(horizontalSize.x).toBeCloseTo(2.4)
    expect(horizontalSize.y).toBeCloseTo(0.6)
    expect(verticalSize.y).toBeCloseTo(3)
    expect(verticalSize.x).toBeCloseTo(0.375)
  })

  it("turns a depth-dominant model toward the profile camera", () => {
    const ownedScene = new Scene()
    ownedScene.add(new Mesh(new BoxGeometry(1, 1, 8), new MeshStandardMaterial()))

    normalizeOwnedScene(ownedScene)

    const size = new Box3().setFromObject(ownedScene).getSize(new Vector3())
    expect(size.x).toBeCloseTo(2.2)
    expect(size.z).toBeLessThan(0.3)
  })

  it("disposes only the cloned resources owned by the model instance", () => {
    const sourceScene = new Scene()
    const sourceTexture = new Texture()
    const sourceGeometry = new BoxGeometry()
    const sourceMaterial = new MeshStandardMaterial({ map: sourceTexture })
    const sourceGeometryDispose = vi.spyOn(sourceGeometry, "dispose")
    const sourceMaterialDispose = vi.spyOn(sourceMaterial, "dispose")
    const sourceTextureDispose = vi.spyOn(sourceTexture, "dispose")
    sourceScene.add(new Mesh(sourceGeometry, sourceMaterial))

    const ownedScene = cloneOwnedScene(sourceScene)
    const ownedMesh = ownedScene.children[0] as Mesh
    const ownedMaterial = ownedMesh.material as MeshStandardMaterial
    const ownedGeometryDispose = vi.spyOn(ownedMesh.geometry, "dispose")
    const ownedMaterialDispose = vi.spyOn(ownedMaterial, "dispose")
    const ownedTextureDispose = vi.spyOn(ownedMaterial.map!, "dispose")

    disposeOwnedScene(ownedScene)

    expect(ownedGeometryDispose).toHaveBeenCalledOnce()
    expect(ownedMaterialDispose).toHaveBeenCalledOnce()
    expect(ownedTextureDispose).toHaveBeenCalledOnce()
    expect(sourceGeometryDispose).not.toHaveBeenCalled()
    expect(sourceMaterialDispose).not.toHaveBeenCalled()
    expect(sourceTextureDispose).not.toHaveBeenCalled()
  })

  it("owns and deduplicates skinned, instanced-morph, and material textures", () => {
    const { scene, sharedTexture, skeleton, nestedUniform } = makeObjectTexturedScene()
    const source = sharedTexture.source
    const sourceImage = sharedTexture.image
    const sourceData = sharedTexture.image.data!
    const sourceValues = Array.from(sourceData)

    const ownedScene = cloneOwnedScene(scene)
    const ownedSkinnedMesh = ownedScene.children[0] as SkinnedMesh
    const ownedInstancedMesh = ownedScene.children[1] as InstancedMesh
    const ownedShaderMesh = ownedScene.children[2] as Mesh
    const ownedMaterial = ownedSkinnedMesh.material as MeshStandardMaterial
    const ownedTexture = ownedSkinnedMesh.skeleton.boneTexture!
    const ownedNested = (ownedShaderMesh.material as ShaderMaterial).uniforms.nested!
      .value as typeof nestedUniform

    expect(ownedTexture).not.toBe(sharedTexture)
    expect(ownedTexture.source).not.toBe(source)
    expect(ownedTexture.image).not.toBe(sourceImage)
    expect(ownedTexture.image.data).not.toBe(sourceData)
    expect(sharedTexture.source).toBe(source)
    expect(sharedTexture.image).toBe(sourceImage)
    expect(sharedTexture.image.data).toBe(sourceData)
    expect(Array.from(sharedTexture.image.data!)).toEqual(sourceValues)
    expect(ownedTexture).toBe(ownedInstancedMesh.morphTexture)
    expect(ownedTexture).toBe(ownedMaterial.map)
    expect(ownedNested).not.toBe(nestedUniform)
    expect(ownedNested.self).toBe(ownedNested)
    expect(ownedNested.direct).toBe(ownedTexture)
    expect((ownedNested.layers as [{ texture: Texture }, Texture[]])[0].texture).toBe(
      ownedTexture,
    )
    expect((ownedNested.layers as [{ texture: Texture }, Texture[]])[1][0]).toBe(ownedTexture)
    expect(ownedSkinnedMesh.skeleton.boneMatrices).not.toBe(skeleton.boneMatrices)
    expect(ownedSkinnedMesh.skeleton.boneMatrices).toBe(ownedTexture.image.data)
  })

  it("disposes a shared owned object texture once without disposing its source", () => {
    const { scene, sharedTexture } = makeObjectTexturedScene()
    const sourceDispose = vi.spyOn(sharedTexture, "dispose")
    const ownedScene = cloneOwnedScene(scene)
    const ownedSkinnedMesh = ownedScene.children[0] as SkinnedMesh
    const ownedTexture = ownedSkinnedMesh.skeleton.boneTexture!
    const ownedDispose = vi.spyOn(ownedTexture, "dispose")

    disposeOwnedScene(ownedScene)

    expect(ownedDispose).toHaveBeenCalledOnce()
    expect(sourceDispose).not.toHaveBeenCalled()
  })
})

describe("model plinth placement and pointer tilt", () => {
  it("places a normalized model with its final bounding-box minimum on the plinth top", () => {
    const ownedScene = new Scene()
    const mesh = new Mesh(new BoxGeometry(2, 4, 1), new MeshStandardMaterial())
    mesh.position.set(1.5, -0.75, 0.5)
    ownedScene.add(mesh)
    normalizeOwnedScene(ownedScene, { maxWidth: 2.4, maxHeight: 2.8 })

    const placedScene = placeOwnedSceneOnPlinth(ownedScene, 0.32)
    const bounds = new Box3().setFromObject(placedScene)

    expect(placedScene).toBe(ownedScene)
    expect(bounds.min.y).toBeCloseTo(0.32)
  })

  it("returns no pointer tilt when reduced motion is preferred", () => {
    expect(resolvePointerTilt([0.8, -0.6], true)).toEqual([0, 0])
  })
})

describe("camera preset contract", () => {
  it("restores position, target, distance clamps, and camera projection", () => {
    const camera = new PerspectiveCamera()
    camera.position.set(12, 13, 14)
    const controls = {
      target: new Vector3(8, 9, 10),
      minDistance: 0,
      maxDistance: 100,
      update: vi.fn(),
    }
    const projectionUpdate = vi.spyOn(camera, "updateProjectionMatrix")
    const matrixUpdate = vi.spyOn(camera, "updateMatrixWorld")
    const preset = sceneProfiles["warm-cabinet"].defaultCamera

    applyCameraPreset(camera, controls, preset)

    expect(camera.position.toArray()).toEqual([0, 0.4, 4.2])
    expect(controls.target.toArray()).toEqual([0, 0.2, 0])
    expect(controls.minDistance).toBe(1.8)
    expect(controls.maxDistance).toBe(7)
    expect(projectionUpdate).toHaveBeenCalledOnce()
    expect(matrixUpdate).toHaveBeenCalledOnce()
    expect(controls.update).toHaveBeenCalledOnce()
  })
})
