export const DISPLAY_PLINTH_TOP_Y = -1.08

type DisplayPlinthProps = {
  topY?: number
}

export function DisplayPlinth({ topY = DISPLAY_PLINTH_TOP_Y }: DisplayPlinthProps) {
  return (
    <group aria-label="Walnut display plinth">
      <mesh castShadow receiveShadow position={[0, topY - 0.255, 0]}>
        <cylinderGeometry args={[1.66, 1.7, 0.11, 64]} />
        <meshStandardMaterial color="#21110b" metalness={0.04} roughness={0.34} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, topY - 0.145, 0]}>
        <cylinderGeometry args={[1.53, 1.59, 0.16, 64]} />
        <meshStandardMaterial color="#4a291b" metalness={0.03} roughness={0.38} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, topY - 0.034, 0]}>
        <cylinderGeometry args={[1.47, 1.5, 0.068, 64]} />
        <meshStandardMaterial color="#70422d" metalness={0.02} roughness={0.42} />
      </mesh>
    </group>
  )
}
