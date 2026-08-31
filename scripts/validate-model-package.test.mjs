import { afterEach, describe, expect, it } from "vitest"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "node:child_process"

const temporaryDirectories = []
const projectRoot = process.cwd()
const script = join(projectRoot, "scripts", "validate-model-package.mjs")
const realPreview = await readFile(join(projectRoot, "public", "covers", "avocado.jpg"))

function makeGlb(document, binary) {
  const json = Buffer.from(JSON.stringify(document))
  const jsonChunk = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)])
  const binChunk = Buffer.concat([binary, Buffer.alloc((4 - (binary.length % 4)) % 4)])
  const file = Buffer.alloc(12 + 8 + jsonChunk.length + 8 + binChunk.length)
  file.writeUInt32LE(0x46546c67, 0)
  file.writeUInt32LE(2, 4)
  file.writeUInt32LE(file.length, 8)
  file.writeUInt32LE(jsonChunk.length, 12)
  file.writeUInt32LE(0x4e4f534a, 16)
  jsonChunk.copy(file, 20)
  const binHeader = 20 + jsonChunk.length
  file.writeUInt32LE(binChunk.length, binHeader)
  file.writeUInt32LE(0x004e4942, binHeader + 4)
  binChunk.copy(file, binHeader + 8)
  return file
}

function makeFixture({ mode = 4, indexed = false, count = 3, image = realPreview, animations, extraBinaryBytes = 0 } = {}) {
  const positionBytes = Buffer.alloc(Math.max(1, count) * 12)
  const indexBytes = indexed ? Buffer.alloc(Math.max(1, count) * 2) : Buffer.alloc(0)
  const imageOffset = positionBytes.length + indexBytes.length
  const binary = Buffer.concat([positionBytes, indexBytes, image, Buffer.alloc(extraBinaryBytes)])
  const accessors = [{ bufferView: 0, componentType: 5126, count, type: "VEC3" }]
  const primitive = { mode, attributes: { POSITION: 0 } }
  const bufferViews = [{ buffer: 0, byteOffset: 0, byteLength: positionBytes.length }]
  if (indexed) {
    bufferViews.push({ buffer: 0, byteOffset: positionBytes.length, byteLength: indexBytes.length })
    accessors.push({ bufferView: 1, componentType: 5123, count, type: "SCALAR" })
    primitive.indices = 1
  }
  bufferViews.push({ buffer: 0, byteOffset: imageOffset, byteLength: image.length })
  const document = {
    asset: { version: "2.0" }, buffers: [{ byteLength: binary.length }], bufferViews, accessors,
    meshes: [{ primitives: [primitive] }],
    images: [{ bufferView: bufferViews.length - 1, mimeType: "image/jpeg" }], textures: [{ source: 0 }],
  }
  if (animations) document.animations = animations
  return { document, binary }
}

function makeSofJpeg(width, height) {
  return Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9])
}

function makePng(width, height) {
  const bytes = Buffer.alloc(24)
  Buffer.from("89504e470d0a1a0a", "hex").copy(bytes)
  bytes.write("IHDR", 12)
  bytes.writeUInt32BE(width, 16)
  bytes.writeUInt32BE(height, 20)
  return bytes
}

function metadata(slug, overrides = {}) {
  return {
    slug, collectionNumber: "900", title: "验证手办", summary: "用于验证导入合同的最小示例。",
    description: "该文件会在导入前由模型包校验器检查。", tags: ["示例", "手办"], tier: "standard",
    model: `/models/${slug}.glb`, cover: `/covers/${slug}.jpg`,
    presentation: { layout: "center-stage", scene: "warm-cabinet", palette: ["#1a2433", "#6a8db7", "#d9a441"], lightingPresets: ["warm"] },
    animation: { mode: "static" }, ...overrides,
  }
}

async function createPackage(slug = "validator-figure", options = {}) {
  const root = await mkdtemp(join(tmpdir(), "gallery-model-package-"))
  temporaryDirectories.push(root)
  const directory = join(root, slug)
  await mkdir(directory)
  const fixture = options.fixture ?? makeFixture(options)
  await writeFile(join(directory, `${slug}.glb`), options.glb ?? makeGlb(fixture.document, fixture.binary))
  await writeFile(join(directory, "preview.jpg"), options.preview ?? realPreview)
  await writeFile(join(directory, "exhibit.json"), JSON.stringify(metadata(slug, options.metadata)))
  return directory
}

function runValidator(...args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: projectRoot })
    let output = ""
    child.stdout.on("data", (chunk) => { output += chunk })
    child.stderr.on("data", (chunk) => { output += chunk })
    child.on("error", reject)
    child.on("close", (code) => resolve({ code, output }))
  })
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })))
})

describe("validate-model-package CLI contract", () => {
  it("accepts a real-decodable 1600×1200 JPEG, static model, and prints handoff fields", async () => {
    const result = await runValidator(await createPackage())
    expect(result.code).toBe(0)
    expect(result.output).toContain("VALID: validator-figure")
    expect(result.output).toContain("GLB: ")
    expect(result.output).toContain("triangles: 1")
    expect(result.output).toContain("textures: JPEG")
    expect(result.output).toContain("clips: none")
  })

  it("returns exit 2 for missing and extra CLI arguments", async () => {
    expect((await runValidator()).code).toBe(2)
    expect((await runValidator("incoming/one", "incoming/two")).code).toBe(2)
  })

  it("rejects any fourth package file", async () => {
    const directory = await createPackage("extra-sidecar")
    await writeFile(join(directory, "source.blend"), "not deployable")
    const result = await runValidator(directory)
    expect(result.code).toBe(1)
    expect(result.output).toContain("ERROR: Unexpected package file: source.blend")
  })

  it("rejects each missing member of the exact three-file layout", async () => {
    for (const filename of ["missing-glb.glb", "preview.jpg", "exhibit.json"]) {
      const directory = await createPackage("missing-glb")
      await rm(join(directory, filename))
      const result = await runValidator(directory)
      expect(result.code).toBe(1)
      expect(result.output).toContain(`ERROR: Missing required file: ${filename}`)
    }
  })

  it("rejects unsafe directory slugs and metadata model/cover/slug mismatches", async () => {
    const mismatch = await createPackage("package-slug", {
      metadata: { slug: "metadata-slug", model: "/models/metadata-slug.glb", cover: "/covers/metadata-slug.jpg" },
    })
    const unsafe = await createPackage("Bad_Slug")
    const mismatchResult = await runValidator(mismatch)
    const unsafeResult = await runValidator(unsafe)
    expect(mismatchResult.output).toContain('ERROR: exhibit.json slug "metadata-slug" must equal directory slug "package-slug"')
    expect(mismatchResult.output).toContain("ERROR: model must be /models/package-slug.glb")
    expect(mismatchResult.output).toContain("ERROR: cover must be /covers/package-slug.jpg")
    expect(unsafeResult.output).toContain('ERROR: Directory name "Bad_Slug" is not a safe slug')
  })

  it("rejects blank required metadata and empty tags", async () => {
    for (const field of ["slug", "collectionNumber", "title", "summary", "description", "model", "cover"]) {
      const result = await runValidator(await createPackage(`blank-${field.toLowerCase()}`, { metadata: { [field]: " " } }))
      expect(result.code).toBe(1)
      expect(result.output).toContain(`ERROR: exhibit.json requires non-empty ${field}`)
    }
    const tags = await runValidator(await createPackage("empty-tags", { metadata: { tags: [] } }))
    expect(tags.output).toContain("ERROR: tags must be a non-empty list of non-empty strings")
  })

  it("requires exactly three hexadecimal palette colors", async () => {
    for (const [slug, palette] of [["palette-missing", undefined], ["palette-two", ["#112233", "#445566"]], ["palette-four", ["#112233", "#445566", "#778899", "#aabbcc"]], ["palette-malformed", ["#112233", "blue", "#778899"]]]) {
      const result = await runValidator(await createPackage(slug, { metadata: { presentation: { layout: "center-stage", scene: "warm-cabinet", palette, lightingPresets: ["warm"] } } }))
      expect(result.code).toBe(1)
      expect(result.output).toContain("ERROR: presentation.palette must contain exactly three #RRGGBB colors")
    }
  })

  it("rejects non-JPEG previews and previews outside exactly 1600×1200", async () => {
    const notJpeg = await runValidator(await createPackage("not-jpeg-preview", { preview: Buffer.from("not jpeg") }))
    const wrongSize = await runValidator(await createPackage("wrong-preview-size", { preview: makeSofJpeg(1200, 1600) }))
    expect(notJpeg.output).toContain("ERROR: preview.jpg is not a readable JPEG")
    expect(wrongSize.output).toContain("ERROR: preview.jpg must be exactly 1600×1200; found 1200×1600")
  })

  it("rejects data URIs and external resource URIs", async () => {
    const fixture = makeFixture()
    fixture.document.buffers[0].uri = "data:application/octet-stream;base64,AA=="
    fixture.document.images[0] = { uri: "data:image/jpeg;base64,AA==", mimeType: "image/jpeg" }
    const result = await runValidator(await createPackage("data-uri", { fixture }))
    expect(result.code).toBe(1)
    expect(result.output).toContain("ERROR: GLB buffer 0 must not declare uri")
    expect(result.output).toContain("ERROR: GLB image 0 must use bufferView; uri is not allowed")
    const http = makeFixture()
    http.document.buffers[0].uri = "https://assets.example/model.bin"
    const relative = makeFixture()
    relative.document.images[0] = { uri: "textures/albedo.png", mimeType: "image/png" }
    expect((await runValidator(await createPackage("http-buffer", { fixture: http }))).output).toContain("ERROR: GLB buffer 0 must not declare uri")
    expect((await runValidator(await createPackage("relative-image", { fixture: relative }))).output).toContain("ERROR: GLB image 0 must use bufferView; uri is not allowed")
  })

  it("rejects malformed headers, chunks, JSON, and logical buffer bounds", async () => {
    const badHeader = await createPackage("bad-header", { glb: Buffer.alloc(12) })
    const badChunk = await createPackage("bad-chunk")
    const bytes = await readFile(join(badChunk, "bad-chunk.glb"))
    bytes.writeUInt32LE(3, 12)
    await writeFile(join(badChunk, "bad-chunk.glb"), bytes)
    const boundsFixture = makeFixture()
    boundsFixture.document.bufferViews[0].byteLength = boundsFixture.binary.length + 1
    const badBounds = await createPackage("bad-bounds", { fixture: boundsFixture })
    const badJson = await createPackage("bad-json")
    const jsonBytes = await readFile(join(badJson, "bad-json.glb"))
    jsonBytes[20] = 0xff
    await writeFile(join(badJson, "bad-json.glb"), jsonBytes)
    const badHeaderResult = await runValidator(badHeader)
    expect(badHeaderResult.output).toContain("ERROR: Invalid bad-header.glb: header magic is not glTF")
    expect(badHeaderResult.output).toContain("GLB: 12 bytes (0.00 MiB)")
    expect(badHeaderResult.output).toContain("triangles: unknown")
    expect(badHeaderResult.output).toContain("textures: unknown")
    expect(badHeaderResult.output).toContain("clips: unknown")
    expect((await runValidator(badChunk)).output).toContain("ERROR: Invalid bad-chunk.glb: GLB chunk length is not 4-byte aligned")
    expect((await runValidator(badJson)).output).toContain("ERROR: Invalid bad-json.glb: JSON chunk cannot be parsed")
    expect((await runValidator(badBounds)).output).toContain("ERROR: bufferView 0 exceeds buffer 0 logical byteLength")
  })

  it("counts indexed/non-indexed TRIANGLES, STRIP and FAN, and ignores non-triangle modes", async () => {
    const cases = [["indexed-triangles", { indexed: true, count: 6, mode: 4 }, 2], ["nonindexed-triangles", { count: 9, mode: 4 }, 3], ["triangle-strip", { indexed: true, count: 5, mode: 5 }, 3], ["triangle-fan", { count: 4, mode: 6 }, 2], ["lines", { count: 8, mode: 1 }, 0]]
    for (const [slug, options, triangles] of cases) {
      const result = await runValidator(await createPackage(slug, options))
      expect(result.code).toBe(0)
      expect(result.output).toContain(`triangles: ${triangles}`)
    }
  })

  it("enforces standard triangle, file, and 2K texture limits", async () => {
    const triangles = await runValidator(await createPackage("standard-triangles", { count: 150_001 * 3 }))
    const file = await runValidator(await createPackage("standard-file", { extraBinaryBytes: 15 * 1024 * 1024 }))
    const textureFixture = makeFixture({ image: makePng(2049, 1) })
    textureFixture.document.images[0].mimeType = "image/png"
    const texture = await runValidator(await createPackage("standard-texture", { fixture: textureFixture }))
    expect(triangles.output).toContain("ERROR: 150001 triangles exceeds standard limit of 150000")
    expect(file.output).toContain("ERROR: standard-file.glb is")
    expect(file.output).toContain("standard allows at most 15 MiB")
    expect(texture.output).toContain("ERROR: texture 0 is 2049×1; standard allows at most 2048×2048")
  })

  it("enforces hero limits and reports the 15–24 MiB preferred-target warning", async () => {
    const triangles = await runValidator(await createPackage("hero-triangles", { count: 250_001 * 3, metadata: { tier: "hero" } }))
    const hardFile = await runValidator(await createPackage("hero-hard-file", { extraBinaryBytes: 24 * 1024 * 1024, metadata: { tier: "hero" } }))
    const warning = await runValidator(await createPackage("hero-warning-file", { extraBinaryBytes: 16 * 1024 * 1024, metadata: { tier: "hero" } }))
    const textureFixture = makeFixture({ image: makePng(4097, 1) })
    textureFixture.document.images[0].mimeType = "image/png"
    const texture = await runValidator(await createPackage("hero-texture", { fixture: textureFixture, metadata: { tier: "hero" } }))
    expect(triangles.output).toContain("ERROR: 250001 triangles exceeds hero limit of 250000")
    expect(hardFile.output).toContain("ERROR: hero-hard-file.glb is")
    expect(hardFile.output).toContain("hero hard limit is 24 MiB")
    expect(warning.code).toBe(0)
    expect(warning.output).toContain("WARNING: hero-warning-file.glb is")
    expect(warning.output).toContain("hero is above the 15 MiB preferred target")
    expect(texture.output).toContain("ERROR: texture 0 is 4097×1; hero allows at most 4096×4096")
  })

  it("rejects invalid accessor references and unparseable image payloads", async () => {
    const accessor = makeFixture()
    accessor.document.accessors[0].componentType = 9999
    const texture = makeFixture({ image: Buffer.from("not an image") })
    const stride = makeFixture()
    stride.document.bufferViews[0].byteStride = 2
    expect((await runValidator(await createPackage("bad-accessor", { fixture: accessor }))).output).toContain("ERROR: accessor 0 has unsupported componentType 9999")
    expect((await runValidator(await createPackage("bad-texture", { fixture: texture }))).output).toContain("ERROR: texture 0 is not a valid PNG, JPEG, or KTX2 payload")
    expect((await runValidator(await createPackage("bad-stride", { fixture: stride }))).output).toContain("ERROR: bufferView 0 has invalid byteStride")
  })

  it("accepts valid PNG and KTX2 texture headers", async () => {
    const png = Buffer.alloc(24); Buffer.from("89504e470d0a1a0a", "hex").copy(png); png.write("IHDR", 12); png.writeUInt32BE(2, 16); png.writeUInt32BE(3, 20)
    const ktx2 = Buffer.alloc(28); Buffer.from("ab4b5458203230bb0d0a1a0a", "hex").copy(ktx2); ktx2.writeUInt32LE(4, 20); ktx2.writeUInt32LE(5, 24)
    for (const [slug, image, mime, description] of [["png-texture", png, "image/png", "PNG 2×3"], ["ktx-texture", ktx2, "image/ktx2", "KTX2 4×5"]]) {
      const fixture = makeFixture({ image }); fixture.document.images[0].mimeType = mime
      const result = await runValidator(await createPackage(slug, { fixture }))
      expect(result.code).toBe(0); expect(result.output).toContain(description)
    }
  })

  it("requires the runtime presentation staging superset and animation-to-clip consistency", async () => {
    const missingRuntime = await createPackage("missing-runtime", { metadata: { presentation: { palette: ["#112233", "#445566", "#778899"] } } })
    const noClip = await createPackage("manual-without-clip", { metadata: { animation: { mode: "manual", clip: "Turn" } } })
    const mismatch = await createPackage("clip-mismatch", { animations: [{ name: "Idle" }], metadata: { animation: { mode: "autoplay", clip: "Turn" } } })
    expect((await runValidator(missingRuntime)).output).toContain("ERROR: presentation.layout must be one of center-stage, story-offset, immersive")
    expect((await runValidator(noClip)).output).toContain("ERROR: animation.mode manual requires at least one GLB animation clip")
    expect((await runValidator(mismatch)).output).toContain('ERROR: animation.clip "Turn" does not exist in GLB clips')
  })
})
