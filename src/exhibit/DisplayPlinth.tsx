export const DISPLAY_PLINTH_TOP_Y = -1.08

type DisplayPlinthProps = {
  topY?: number
}

export function DisplayPlinth({ topY = DISPLAY_PLINTH_TOP_Y }: DisplayPlinthProps) {
  return (
    <group aria-label="Walnut display plinth">
      <mesh castShadow receiveShadow position={[0, topY - 0.18, 0]}>
        <cylinderGeometry args={[1.55, 1.58, 0.06, 96]} />
        <meshStandardMaterial color="#201915" metalness={0.04} roughness={0.6} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, topY - 0.1, 0]}>
        <cylinderGeometry args={[1.49, 1.55, 0.1, 96]} />
        <meshStandardMaterial color="#39291f" metalness={0.02} roughness={0.58} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, topY - 0.025, 0]}>
        <cylinderGeometry args={[1.47, 1.49, 0.05, 96]} />
        <meshStandardMaterial color="#594333" metalness={0.02} roughness={0.64} />
      </mesh>
    </group>
  )
}
