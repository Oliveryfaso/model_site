import { useGLTF } from "@react-three/drei"

export function clearModelLoaderCache(model: string) {
  useGLTF.clear(model)
}
