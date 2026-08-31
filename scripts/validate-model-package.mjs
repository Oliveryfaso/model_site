import { readdir, readFile, stat } from "node:fs/promises"
import { basename, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const MIB = 1024 * 1024
const GLB_MAGIC = 0x46546c67
const JSON_CHUNK = 0x4e4f534a
const BIN_CHUNK = 0x004e4942
const COMPONENT_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }
const TYPE_COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }
const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])
const layouts = new Set(["center-stage", "story-offset", "immersive"])
const scenes = new Set(["warm-cabinet", "star-mist", "cold-chamber"])
const lights = new Set(["warm", "rim", "moon", "starlight", "top", "scan"])

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
const array = (value) => Array.isArray(value) ? value : []
const string = (value) => typeof value === "string" && value.trim().length > 0
const integer = (value) => Number.isInteger(value) && value >= 0

function parseGlb(bytes) {
  if (bytes.length < 12) throw new Error("file is shorter than the 12-byte GLB header")
  if (bytes.readUInt32LE(0) !== GLB_MAGIC) throw new Error("header magic is not glTF")
  if (bytes.readUInt32LE(4) !== 2) throw new Error("only GLB version 2 is supported")
  if (bytes.readUInt32LE(8) !== bytes.length) throw new Error(`header declares ${bytes.readUInt32LE(8)} bytes but file contains ${bytes.length}`)
  let offset = 12
  const chunks = []
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error("truncated GLB chunk header")
    const length = bytes.readUInt32LE(offset)
    const type = bytes.readUInt32LE(offset + 4)
    if (length % 4 !== 0) throw new Error("GLB chunk length is not 4-byte aligned")
    offset += 8
    if (offset + length > bytes.length) throw new Error("GLB chunk extends beyond file length")
    chunks.push({ type, bytes: bytes.subarray(offset, offset + length) })
    offset += length
  }
  if (chunks.length !== 2 || chunks[0].type !== JSON_CHUNK || chunks[1].type !== BIN_CHUNK) {
    throw new Error("must contain exactly one JSON chunk followed by one BIN chunk")
  }
  let document
  try { document = JSON.parse(new TextDecoder().decode(chunks[0].bytes).replace(/[\u0000\s]+$/, "")) } catch { throw new Error("JSON chunk cannot be parsed") }
  return { document, binary: chunks[1].bytes }
}

function png(bytes) {
  if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || bytes.subarray(12, 16).toString() !== "IHDR") return undefined
  return { format: "PNG", width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}
function jpeg(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined
  for (let offset = 2; offset + 4 <= bytes.length;) {
    while (bytes[offset] === 0xff) offset += 1
    const marker = bytes[offset++]
    if (marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue
    const length = bytes.readUInt16BE(offset)
    if (length < 2 || offset + length > bytes.length) return undefined
    if (JPEG_SOF.has(marker) && length >= 7) return { format: "JPEG", height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) }
    offset += length
  }
  return undefined
}
function ktx2(bytes) {
  if (bytes.length < 28 || bytes.subarray(0, 12).toString("hex") !== "ab4b5458203230bb0d0a1a0a") return undefined
  return { format: "KTX2", width: bytes.readUInt32LE(20), height: bytes.readUInt32LE(24) }
}
const imageInfo = (bytes) => png(bytes) ?? jpeg(bytes) ?? ktx2(bytes)

function validateMetadata(value, slug, errors) {
  if (!isRecord(value)) { errors.push("exhibit.json must contain a JSON object"); return undefined }
  for (const field of ["slug", "collectionNumber", "title", "summary", "description", "model", "cover"]) if (!string(value[field])) errors.push(`exhibit.json requires non-empty ${field}`)
  if (value.slug !== slug) errors.push(`exhibit.json slug "${value.slug ?? ""}" must equal directory slug "${slug}"`)
  if (value.model !== `/models/${slug}.glb`) errors.push(`model must be /models/${slug}.glb`)
  if (value.cover !== `/covers/${slug}.jpg`) errors.push(`cover must be /covers/${slug}.jpg`)
  if (!array(value.tags).length || array(value.tags).some((tag) => !string(tag))) errors.push("tags must be a non-empty list of non-empty strings")
  if (!["standard", "hero"].includes(value.tier)) errors.push("tier must be either standard or hero")
  const presentation = value.presentation
  if (!isRecord(presentation) || !layouts.has(presentation.layout)) errors.push("presentation.layout must be one of center-stage, story-offset, immersive")
  if (!isRecord(presentation) || !scenes.has(presentation.scene)) errors.push("presentation.scene must be one of warm-cabinet, star-mist, cold-chamber")
  if (!isRecord(presentation) || !Array.isArray(presentation.palette) || presentation.palette.length !== 3 || presentation.palette.some((color) => typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color))) errors.push("presentation.palette must contain exactly three #RRGGBB colors")
  if (!isRecord(presentation) || !array(presentation.lightingPresets).length || array(presentation.lightingPresets).some((preset) => !lights.has(preset))) errors.push("presentation.lightingPresets must be a non-empty list of supported presets")
  if (value.animation !== undefined && (!isRecord(value.animation) || !["static", "manual", "autoplay"].includes(value.animation.mode))) errors.push("animation.mode must be static, manual, or autoplay")
  return value
}

function validateDocument(document, binary, errors, warnings) {
  if (!isRecord(document) || !isRecord(document.asset) || document.asset.version !== "2.0") errors.push("GLB JSON asset.version must be \"2.0\"")
  const buffers = array(document.buffers)
  if (buffers.length !== 1 || !isRecord(buffers[0]) || !integer(buffers[0].byteLength)) errors.push("GLB must declare exactly one buffer with byteLength")
  buffers.forEach((buffer, index) => {
    if (isRecord(buffer) && Object.hasOwn(buffer, "uri")) errors.push(`GLB buffer ${index} must not declare uri`)
  })
  const logical = buffers.length === 1 && integer(buffers[0]?.byteLength) ? buffers[0].byteLength : 0
  if (binary.length < logical || binary.length - logical > 3) errors.push("BIN chunk length must equal buffer byteLength plus 0–3 padding bytes")
  const views = array(document.bufferViews)
  views.forEach((view, index) => {
    if (!isRecord(view) || view.buffer !== 0 || !integer(view.byteLength) || (view.byteOffset !== undefined && !integer(view.byteOffset))) { errors.push(`bufferView ${index} must reference buffer 0 with valid byteOffset and byteLength`); return }
    const start = view.byteOffset ?? 0
    if (start + view.byteLength > logical) errors.push(`bufferView ${index} exceeds buffer 0 logical byteLength`)
    if (view.byteStride !== undefined && (!integer(view.byteStride) || view.byteStride < 4 || view.byteStride > 252 || view.byteStride % 4)) errors.push(`bufferView ${index} has invalid byteStride`)
  })
  const accessors = array(document.accessors)
  accessors.forEach((accessor, index) => {
    if (!isRecord(accessor) || !integer(accessor.bufferView) || !Object.hasOwn(COMPONENT_BYTES, accessor.componentType)) { errors.push(`accessor ${index} has unsupported componentType ${accessor?.componentType}`); return }
    if (!Object.hasOwn(TYPE_COMPONENTS, accessor.type) || !integer(accessor.count) || (accessor.byteOffset !== undefined && !integer(accessor.byteOffset))) { errors.push(`accessor ${index} has invalid type, count, or byteOffset`); return }
    const view = views[accessor.bufferView]
    if (!isRecord(view)) { errors.push(`accessor ${index} references missing bufferView ${accessor.bufferView}`); return }
    const element = COMPONENT_BYTES[accessor.componentType] * TYPE_COMPONENTS[accessor.type]
    const stride = view.byteStride ?? element
    const start = accessor.byteOffset ?? 0
    if (stride < element || start + (accessor.count ? (accessor.count - 1) * stride + element : 0) > view.byteLength) errors.push(`accessor ${index} exceeds bufferView ${accessor.bufferView} bounds`)
  })
  const textures = []
  array(document.images).forEach((image, index) => {
    if (!isRecord(image) || Object.hasOwn(image, "uri")) { errors.push(`GLB image ${index} must use bufferView; uri is not allowed`); return }
    if (!integer(image.bufferView) || !isRecord(views[image.bufferView])) { errors.push(`GLB image ${index} references an invalid bufferView`); return }
    const view = views[image.bufferView]; const start = view.byteOffset ?? 0
    const info = imageInfo(binary.subarray(start, start + view.byteLength))
    if (!info || !["image/png", "image/jpeg", "image/ktx2"].includes(image.mimeType) || image.mimeType !== `image/${info.format.toLowerCase()}`) { errors.push(`texture ${index} is not a valid PNG, JPEG, or KTX2 payload`); return }
    textures.push({ index, ...info })
  })
  let triangles = 0
  array(document.meshes).forEach((mesh, meshIndex) => array(mesh?.primitives).forEach((primitive, primitiveIndex) => {
    const mode = Number.isInteger(primitive?.mode) ? primitive.mode : 4
    if (![4, 5, 6].includes(mode)) return
    const reference = integer(primitive.indices) ? primitive.indices : primitive?.attributes?.POSITION
    const accessor = accessors[reference]
    if (!isRecord(accessor) || !integer(accessor.count)) { errors.push(`mesh ${meshIndex} primitive ${primitiveIndex} cannot be counted for triangle budget`); return }
    if (integer(primitive.indices) && accessor.type !== "SCALAR") errors.push(`mesh ${meshIndex} primitive ${primitiveIndex} indices accessor must be SCALAR`)
    if (!integer(primitive.indices) && accessor.type !== "VEC3") errors.push(`mesh ${meshIndex} primitive ${primitiveIndex} POSITION accessor must be VEC3`)
    triangles += mode === 4 ? Math.floor(accessor.count / 3) : Math.max(0, accessor.count - 2)
  }))
  const clips = []
  array(document.animations).forEach((animation, index) => { if (!string(animation?.name)) errors.push(`Animation clip ${index} must have a non-empty name`); else clips.push(animation.name.trim()) })
  if (clips.length && !clips.includes("Idle")) warnings.push("Animation clips are present but none is named Idle")
  return { triangles, textures, clips }
}

export async function validateModelPackage(packagePath) {
  const report = { errors: [], warnings: [], details: {} }
  const directory = resolve(packagePath); const slug = basename(directory)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { report.errors.push(`Directory name "${slug}" is not a safe slug`); return report }
  const expected = new Set([`${slug}.glb`, "preview.jpg", "exhibit.json"])
  try { for (const entry of await readdir(directory)) if (!expected.has(entry)) report.errors.push(`Unexpected package file: ${entry}`) } catch { report.errors.push(`Package directory cannot be read: ${directory}`); return report }
  const files = await Promise.all([...expected].map(async (name) => { try { const path = join(directory, name); if (!(await stat(path)).isFile()) throw new Error(); return [name, await readFile(path)] } catch { report.errors.push(`Missing required file: ${name}`); return [name, undefined] } }))
  const contents = Object.fromEntries(files)
  let metadata
  if (contents["exhibit.json"]) { try { metadata = validateMetadata(JSON.parse(contents["exhibit.json"].toString()), slug, report.errors) } catch { report.errors.push("exhibit.json is not valid JSON") } }
  if (contents["preview.jpg"]) { const info = jpeg(contents["preview.jpg"]); if (!info) report.errors.push("preview.jpg is not a readable JPEG"); else { report.details.preview = info; if (info.width !== 1600 || info.height !== 1200) report.errors.push(`preview.jpg must be exactly 1600×1200; found ${info.width}×${info.height}`) } }
  const glb = contents[`${slug}.glb`]
  if (!glb) return report
  report.details.fileSize = glb.length
  let parsed
  try { parsed = parseGlb(glb) } catch (error) { report.errors.push(`Invalid ${slug}.glb: ${error.message}`); return report }
  const details = validateDocument(parsed.document, parsed.binary, report.errors, report.warnings)
  Object.assign(report.details, details)
  if (metadata && ["standard", "hero"].includes(metadata.tier)) {
    const limit = metadata.tier === "standard" ? 150000 : 250000; const textureLimit = metadata.tier === "standard" ? 2048 : 4096
    if (details.triangles > limit) report.errors.push(`${details.triangles} triangles exceeds ${metadata.tier} limit of ${limit}`)
    details.textures.forEach((texture) => { if (texture.width > textureLimit || texture.height > textureLimit) report.errors.push(`texture ${texture.index} is ${texture.width}×${texture.height}; ${metadata.tier} allows at most ${textureLimit}×${textureLimit}`) })
    if (glb.length > (metadata.tier === "standard" ? 15 : 24) * MIB) report.errors.push(`${slug}.glb is ${(glb.length / MIB).toFixed(2)} MiB; ${metadata.tier === "standard" ? "standard allows at most 15 MiB" : "hero hard limit is 24 MiB"}`)
    else if (metadata.tier === "hero" && glb.length > 15 * MIB) report.warnings.push(`${slug}.glb is ${(glb.length / MIB).toFixed(2)} MiB; hero is above the 15 MiB preferred target`)
  }
  const animation = metadata?.animation
  if (isRecord(animation) && ["manual", "autoplay"].includes(animation.mode) && !details.clips.length) report.errors.push(`animation.mode ${animation.mode} requires at least one GLB animation clip`)
  if (isRecord(animation) && animation.clip !== undefined && (!string(animation.clip) || !details.clips.includes(animation.clip))) report.errors.push(`animation.clip "${animation.clip}" does not exist in GLB clips`)
  return report
}

function printReport(slug, report) {
  for (const error of report.errors) console.error(`ERROR: ${error}`)
  for (const warning of report.warnings) console.warn(`WARNING: ${warning}`)
  if (report.details.fileSize !== undefined) console.log(`GLB: ${report.details.fileSize} bytes (${(report.details.fileSize / MIB).toFixed(2)} MiB)`)
  console.log(`triangles: ${report.details.triangles ?? "unknown"}`)
  if (report.details.preview) console.log(`preview: ${report.details.preview.width}×${report.details.preview.height} JPEG`)
  console.log(`textures: ${report.details.textures ? (report.details.textures.length ? report.details.textures.map((texture) => `${texture.format} ${texture.width}×${texture.height}`).join(", ") : "none") : "unknown"}`)
  console.log(`clips: ${report.details.clips ? report.details.clips.join(", ") || "none" : "unknown"}`)
  if (!report.errors.length) console.log(`VALID: ${slug}`)
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length !== 1) { console.error("Usage: npm run models:validate -- incoming/<slug>"); process.exitCode = 2; return }
  const report = await validateModelPackage(args[0]); printReport(basename(resolve(args[0])), report); process.exitCode = report.errors.length ? 1 : 0
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main()
