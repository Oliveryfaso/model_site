import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

const sampleRate = 22_050
const seconds = 8

function writeAmbientWav(path: string, frequencies: readonly number[], gain: number) {
  const sampleCount = sampleRate * seconds
  const data = Buffer.alloc(sampleCount * 2)
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate
    const edge = Math.min(
      1,
      index / (sampleRate * 0.2),
      (sampleCount - 1 - index) / (sampleRate * 0.2),
    )
    const wave = frequencies.reduce((sum, frequency, harmonic) => {
      return (
        sum +
        Math.sin(2 * Math.PI * frequency * time + harmonic * 0.7) / frequencies.length
      )
    }, 0)
    data.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, wave * gain * edge)) * 32_767),
      index * 2,
    )
  }

  const header = Buffer.alloc(44)
  header.write("RIFF", 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write("WAVEfmt ", 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write("data", 36)
  header.writeUInt32LE(data.length, 40)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, Buffer.concat([header, data]))
}

writeAmbientWav(resolve("public/audio/collection-theme.wav"), [55, 82.5, 110], 0.12)
writeAmbientWav(resolve("public/audio/fox-ambient.wav"), [73.5, 110, 147], 0.09)
