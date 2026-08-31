import type { SceneProfile } from "./sceneProfiles"

export type SceneEnvironmentProps = {
  profile: SceneProfile
  shadows: boolean
}

export function SceneEnvironment({ profile, shadows }: SceneEnvironmentProps) {
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
