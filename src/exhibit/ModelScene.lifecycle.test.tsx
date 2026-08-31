import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Box3, BoxGeometry, Mesh, MeshStandardMaterial, Scene, Vector3 } from "three"

const lifecycleHarness = vi.hoisted(() => ({
  animationRoot: undefined as unknown,
  sourceScene: undefined as unknown,
}))

vi.mock("@react-three/drei", () => ({
  Bounds: ({ children }: { children: React.ReactNode }) => children,
  OrbitControls: () => null,
  useGLTF: () => ({ scene: lifecycleHarness.sourceScene, animations: [] }),
}))

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => children,
  useThree: () => ({ size: { width: 800, height: 600 } }),
}))

vi.mock("./AnimationController", () => ({
  AnimationController: ({ scene }: { scene: Scene }) => {
    lifecycleHarness.animationRoot = scene
    return null
  },
}))

import { OwnedModel } from "./ModelScene"

describe("OwnedModel responsive framing lifecycle", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("keeps one owned scene and animation root while frame constraints change", () => {
    const sourceScene = new Scene()
    const sourceGeometry = new BoxGeometry(4, 2, 1)
    const sourceMaterial = new MeshStandardMaterial()
    sourceScene.add(new Mesh(sourceGeometry, sourceMaterial))
    lifecycleHarness.sourceScene = sourceScene
    const sourceGeometryDispose = vi.spyOn(sourceGeometry, "dispose")
    const onReady = vi.fn()

    const view = render(
      <OwnedModel
        model="/models/test.glb"
        frame={{ maxWidth: 2, maxHeight: 2 }}
        onReady={onReady}
      />,
    )
    const firstRoot = lifecycleHarness.animationRoot as Scene
    const firstSize = new Box3().setFromObject(firstRoot).getSize(new Vector3())
    const ownedGeometry = (firstRoot.children[0] as Mesh).geometry
    const ownedGeometryDispose = vi.spyOn(ownedGeometry, "dispose")

    view.rerender(
      <OwnedModel
        model="/models/test.glb"
        frame={{ maxWidth: 1, maxHeight: 2 }}
        onReady={onReady}
      />,
    )
    const secondRoot = lifecycleHarness.animationRoot as Scene
    const secondSize = new Box3().setFromObject(secondRoot).getSize(new Vector3())

    expect(secondRoot).toBe(firstRoot)
    expect(firstSize.x).toBeCloseTo(2)
    expect(secondSize.x).toBeCloseTo(1)
    expect(onReady).toHaveBeenCalledOnce()
    expect(ownedGeometryDispose).not.toHaveBeenCalled()
    expect(sourceGeometryDispose).not.toHaveBeenCalled()

    view.unmount()
    expect(ownedGeometryDispose).toHaveBeenCalledOnce()
    expect(sourceGeometryDispose).not.toHaveBeenCalled()
  })
})
