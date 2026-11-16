// Procedural 3D hold shapes and colors for Wall3DComponent.
import * as THREE from 'three'

export const HOLD_TYPES = ['jug', 'crimp', 'sloper', 'pinch', 'pocket']

// Hold catalog color names -> paint colors. Keys have spaces removed so they also match
// filenames like "pocket-brickred-large.png".
const COLOR_HEX = {
  black: '#26282b',
  green: '#2f9e44',
  pink: '#e64980',
  yellow: '#f5c518',
  babyblue: '#74c0fc',
  orange: '#f76707',
  brown: '#8a5a3b',
  cyan: '#15aabf',
  brickred: '#b23a2e',
  navyblue: '#22357a',
  purple: '#7048e8',
  blue: '#1c7ed6',
  red: '#e03131',
  white: '#e9ecef',
  gray: '#868e96',
  grey: '#868e96',
}
const FALLBACK_HEX = '#9aa0a6'

const fileTokens = (hold) =>
  (hold.imageUrl ?? '').split('/').pop().replace(/\.\w+$/, '').toLowerCase().split('-')

// Hold type from the API, else the first word of the image filename (e.g. "jug-green-large.png")
export function getHoldType(hold) {
  if (HOLD_TYPES.includes(hold.holdType)) return hold.holdType
  return HOLD_TYPES.find((type) => fileTokens(hold)[0] === type) ?? 'sloper'
}

// Color name from the API, else a color word in the image filename
export function getHoldColor(hold) {
  const named = hold.color?.toLowerCase().replace(/\s+/g, '')
  if (COLOR_HEX[named]) return { name: hold.color, hex: COLOR_HEX[named] }
  const token = fileTokens(hold).find((word) => COLOR_HEX[word])
  return token ? { name: token, hex: COLOR_HEX[token] } : { name: 'unpainted', hex: FALLBACK_HEX }
}

// Small seeded random generator so the same hold always gets the same shape
function seeded(seed) {
  let value = (seed * 9301 + 49297) % 233280
  return () => {
    value = (value * 9301 + 49297) % 233280
    return value / 233280
  }
}

const smooth = (t) => Math.max(0, Math.min(1, t))
// 1 at the center of a circle, easing to 0 at its edge
const bump = (x, y, cx, cy, rx, ry) => {
  const d = (x - cx) ** 2 / rx ** 2 + (y - cy) ** 2 / ry ** 2
  return d < 1 ? (1 - d) ** 2 : 0
}

// Reshape a unit dome (x, y in the unit disc, z = height off the wall) into a hold type.
// "Up" on the wall is +y.
const SHAPERS = {
  // Big incut bowl near the top with a thick lip
  jug(x, y, z) {
    x *= 1.0
    y *= 0.82
    z *= 0.85
    z -= 0.55 * bump(x, y, 0, 0.3, 0.62, 0.34)
    return [x, y, Math.max(z, 0.04 * Math.sign(z))]
  },
  // Thin horizontal ledge that gets taller toward its top edge
  crimp(x, y, z) {
    x *= 1.15
    y *= 0.36
    z *= 0.42 * (0.55 + 0.45 * smooth((y / 0.36 + 1) / 2))
    return [x, y, z]
  },
  // Wide, low, rounded dome that rolls off at the top
  sloper(x, y, z) {
    y *= 0.9
    z *= 0.42 * (1 - 0.3 * smooth(y))
    return [x, y, z]
  },
  // Tall vertical fin to squeeze from both sides
  pinch(x, y, z) {
    x *= 0.42
    z *= 0.75 * (1 - 0.35 * Math.abs(y))
    return [x, y, z]
  },
  // Rounded dome with two finger holes drilled in
  pocket(x, y, z) {
    y *= 0.85
    z *= 0.62
    z -= 0.42 * bump(x, y, -0.32, 0.08, 0.24, 0.26)
    z -= 0.36 * bump(x, y, 0.3, 0.02, 0.22, 0.24)
    return [x, y, Math.max(z, 0.03 * Math.sign(z))]
  },
}

const geometryCache = new Map()

// A unit-radius hold shape (scale it by the hold's footprint radius). Cached per type and seed.
export function getHoldGeometry(type, seed = 1) {
  const key = `${type}-${seed}`
  if (geometryCache.has(key)) return geometryCache.get(key)

  const random = seeded(seed)
  const phase1 = random() * Math.PI * 2
  const phase2 = random() * Math.PI * 2
  const shaper = SHAPERS[type] ?? SHAPERS.sloper

  // Top half of a sphere, turned so the dome points out of the wall (+z)
  const geometry = new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2)
  geometry.rotateX(Math.PI / 2)
  const position = geometry.attributes.position

  for (let i = 0; i < position.count; i++) {
    let x = position.getX(i)
    let y = position.getY(i)
    let z = position.getZ(i)
    // Organic wobble around the outline so no two holds look machine-made
    const angle = Math.atan2(y, x)
    const wobble = 1 + 0.07 * Math.sin(angle * 3 + phase1) + 0.04 * Math.sin(angle * 5 + phase2)
    x *= wobble
    y *= wobble
    ;[x, y, z] = shaper(x, y, z)
    position.setXYZ(i, x, y, Math.max(z, 0))
  }

  geometry.computeVertexNormals()
  geometryCache.set(key, geometry)
  return geometry
}

// Canvas textures are generated once and shared by every wall
let wallTextures
export function getWallTextures() {
  if (wallTextures) return wallTextures

  // Painted plywood face: 3 x 2 panels, speckled textured paint
  const face = document.createElement('canvas')
  face.width = 768
  face.height = 1024
  const ctx = face.getContext('2d')
  ctx.fillStyle = '#cfcabe'
  ctx.fillRect(0, 0, face.width, face.height)
  const random = seeded(7)
  for (let i = 0; i < 26000; i++) {
    const shade = random() < 0.5 ? 255 : 0
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${0.03 + random() * 0.06})`
    ctx.fillRect(random() * face.width, random() * face.height, 1 + random() * 2, 1 + random() * 2)
  }
  // Chalk smudges where hands have been
  for (let i = 0; i < 40; i++) {
    const x = random() * face.width
    const y = random() * face.height
    const r = 10 + random() * 40
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
    gradient.addColorStop(0, 'rgba(255,255,255,0.10)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  // Panel seams
  ctx.strokeStyle = 'rgba(40,36,30,0.45)'
  ctx.lineWidth = 3
  for (const x of [face.width / 3, (face.width * 2) / 3]) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, face.height); ctx.stroke()
  }
  ctx.beginPath(); ctx.moveTo(0, face.height / 2); ctx.lineTo(face.width, face.height / 2); ctx.stroke()

  const faceTexture = new THREE.CanvasTexture(face)
  faceTexture.colorSpace = THREE.SRGBColorSpace
  faceTexture.anisotropy = 8

  // Plywood edge: thin alternating veneer layers running across the board's thickness
  const edge = document.createElement('canvas')
  edge.width = 64
  edge.height = 16
  const edgeCtx = edge.getContext('2d')
  for (let x = 0; x < edge.width; x += 8) {
    edgeCtx.fillStyle = (x / 8) % 2 ? '#c7a574' : '#a8824f'
    edgeCtx.fillRect(x, 0, 8, edge.height)
  }
  const edgeTexture = new THREE.CanvasTexture(edge)
  edgeTexture.colorSpace = THREE.SRGBColorSpace

  // Fine grit bump for the hold surfaces
  const grit = document.createElement('canvas')
  grit.width = grit.height = 128
  const gritCtx = grit.getContext('2d')
  const image = gritCtx.createImageData(128, 128)
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 110 + random() * 145
    image.data[i] = image.data[i + 1] = image.data[i + 2] = v
    image.data[i + 3] = 255
  }
  gritCtx.putImageData(image, 0, 0)
  const gritTexture = new THREE.CanvasTexture(grit)
  gritTexture.wrapS = gritTexture.wrapT = THREE.RepeatWrapping
  gritTexture.repeat.set(3, 3)

  wallTextures = { face: faceTexture, edge: edgeTexture, grit: gritTexture }
  return wallTextures
}

// ───────────── Photo relief: 3D holds built from their own PNG ─────────────
// The hold photo is draped over a grid whose height comes from the photo itself:
//  - the transparent background cuts out the hold's exact silhouette
//  - distance from the silhouette's edge makes it bulge like a molded hold (thick parts rise higher)
//  - darker pixels sink and lighter ones rise, so incuts, pockets and the bolt hole get real depth
const RELIEF_SEGMENTS = 96
const EDGE_BAND = 2.5 // pixels (of 96) around the outline that stay flat on the wall
const reliefCache = new Map() // url -> Promise<{ geometry, texture }>
const reliefReady = new Map() // url -> { geometry, texture } once built

function buildRelief(image) {
  const size = RELIEF_SEGMENTS
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)

  const count = size * size
  const inside = new Uint8Array(count)
  const luminance = new Float32Array(count)
  let lumSum = 0
  let insideCount = 0
  for (let i = 0; i < count; i++) {
    const [r, g, b] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]
    // Opaque and not leftover white photo background (e.g. the hole in a ring-shaped pocket)
    if (data[i * 4 + 3] > 128 && !(r > 232 && g > 232 && b > 232)) {
      inside[i] = 1
      luminance[i] = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255
      lumSum += luminance[i]
      insideCount++
    }
  }
  const lumMean = insideCount ? lumSum / insideCount : 0.5

  // Two-pass chamfer distance transform: pixels from the nearest edge of the silhouette
  const distance = new Float32Array(count)
  for (let i = 0; i < count; i++) distance[i] = inside[i] ? 1e6 : 0
  const at = (x, y) => (x < 0 || y < 0 || x >= size || y >= size ? 0 : distance[y * size + x])
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      if (!inside[i]) continue
      distance[i] = Math.min(distance[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.4142, at(x + 1, y - 1) + 1.4142)
    }
  }
  let maxDistance = 1
  for (let y = size - 1; y >= 0; y--) {
    for (let x = size - 1; x >= 0; x--) {
      const i = y * size + x
      if (!inside[i]) continue
      distance[i] = Math.min(distance[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.4142, at(x - 1, y + 1) + 1.4142)
      maxDistance = Math.max(maxDistance, distance[i])
    }
  }

  // Rounded dome over the silhouette plus surface detail from the photo's shading
  let height = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    if (!inside[i]) continue
    // The outermost pixels stay flat on the wall: that's where the photo's soft cutout edge is,
    // and lifting it would stretch that edge into a comb-like fringe down the hold's side
    const t = Math.min(Math.max(distance[i] - EDGE_BAND, 0) / (maxDistance - EDGE_BAND), 1)
    // Rounded shoulder that meets the wall at a gentle slope; a vertical edge would show the
    // stair-stepped alpha cutout as a jagged fringe
    const dome = 1 - (1 - t) ** 2.4
    // Dark areas (incuts, pocket holes, the bolt hole) sink; highlights may only lift a little,
    // otherwise the shiny bolt washer and photo glare turn into spikes
    const detail = Math.max(-0.35, Math.min(0.08, (luminance[i] - lumMean) * 1.1))
    height[i] = Math.max(0, dome * 0.8 + detail * Math.min(1, t * 3) * 0.55)
  }

  // A few light box blurs so the photo grain doesn't turn into spikes
  for (let pass = 0; pass < 3; pass++) {
    const next = new Float32Array(count)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x
        if (!inside[i]) continue
        let sum = 0
        let n = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx
            const yy = y + dy
            if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue
            sum += height[yy * size + xx]
            n++
          }
        }
        next[i] = sum / n
      }
    }
    height = next
  }

  for (let i = 0; i < count; i++) if (distance[i] <= EDGE_BAND) height[i] = 0

  let maxHeight = 0
  for (let i = 0; i < count; i++) maxHeight = Math.max(maxHeight, height[i])

  // Unit square facing +z; row 0 of the grid is the top of the image, matching the texture's UVs
  const geometry = new THREE.PlaneGeometry(1, 1, size - 1, size - 1)
  const position = geometry.attributes.position
  for (let i = 0; i < position.count; i++) position.setZ(i, maxHeight ? height[i] / maxHeight : 0)
  geometry.computeVertexNormals()

  const texture = new THREE.Texture(image)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.needsUpdate = true

  return { geometry, texture }
}

export function loadHoldRelief(url) {
  if (!reliefCache.has(url)) {
    const promise = new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => {
        const relief = buildRelief(image)
        reliefReady.set(url, relief)
        resolve(relief)
      }
      image.onerror = reject
      image.src = url
    })
    // A failed image can be retried later
    promise.catch(() => reliefCache.delete(url))
    reliefCache.set(url, promise)
  }
  return reliefCache.get(url)
}

// The relief for this image if it's already built, otherwise undefined
export const getReadyRelief = (url) => reliefReady.get(url)
