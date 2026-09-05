import type { SceneProfile } from "./sceneProfiles"
import { useFrame } from "@react-three/fiber"
import { Fog } from "three"

export type SceneEnvironmentProps = {
  profile: SceneProfile
  shadows: boolean
}

export function SceneEnvironment({ profile, shadows }: SceneEnvironmentProps) {
  useFrame(({ camera, scene }) => {
    if (scene.fog instanceof Fog && profile.fog) {
      // Keep atmosphere behind the exhibit as the viewing distance changes.
      const distance = camera.position.length()
      scene.fog.near = Math.max(profile.fog.near, distance + 3)
      scene.fog.far = scene.fog.near + (profile.fog.far - profile.fog.near)
    }
  })
  return (
    <>
      {profile.fog ? (
        <fog
          attach="fog"
          args={[profile.fog.color, profile.fog.near, profile.fog.far]}
        />
      ) : null}
      <ambientLight intensity={0.65} />
      <directionalLight
        castShadow={shadows}
        color="#f2d0a0"
        intensity={1.7}
        position={[3, 5, 4]}
      />
      <hemisphereLight args={["#a9bed2", "#2a1710", 0.7]} />
    </>
  )
}
