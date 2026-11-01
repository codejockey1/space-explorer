import * as THREE from 'three'

/** Shared PBR helpers for spacecraft detailing. */
const metal = (color: number, emissive = 0x000000, ei = 0, metalness = 0.72, roughness = 0.32) =>
  new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    emissive: new THREE.Color(emissive),
    emissiveIntensity: ei,
  })

const mlsi = (color = 0xd8dde4) => metal(color, 0x000000, 0, 0.35, 0.55) // multi-layer insulation look
const darkMetal = () => metal(0x2a2e34, 0x000000, 0, 0.8, 0.28)
const goldFoil = () => metal(0xc9a227, 0x553300, 0.08, 0.85, 0.35)
const whiteBus = () => metal(0xe8ecf2, 0x000000, 0, 0.45, 0.42)
const radiators = () =>
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.15,
    roughness: 0.35,
    emissive: new THREE.Color(0x1a2030),
    emissiveIntensity: 0.04,
  })

const panelMat = () =>
  new THREE.MeshStandardMaterial({
    color: 0x143a6e,
    metalness: 0.65,
    roughness: 0.35,
    emissive: new THREE.Color(0x0a2040),
    emissiveIntensity: 0.22,
  })

const panelCell = () =>
  new THREE.MeshStandardMaterial({
    color: 0x0c2850,
    metalness: 0.7,
    roughness: 0.28,
    emissive: new THREE.Color(0x081830),
    emissiveIntensity: 0.18,
  })

function addMesh(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  pos?: [number, number, number],
  rot?: [number, number, number],
) {
  const m = new THREE.Mesh(geo, mat)
  if (pos) m.position.set(...pos)
  if (rot) m.rotation.set(...rot)
  parent.add(m)
  return m
}

function addBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  pos: [number, number, number],
  rot?: [number, number, number],
) {
  return addMesh(parent, new THREE.BoxGeometry(w, h, d), mat, pos, rot)
}

function addCyl(
  parent: THREE.Object3D,
  rTop: number,
  rBot: number,
  h: number,
  mat: THREE.Material,
  pos: [number, number, number],
  rot?: [number, number, number],
  segments = 20,
) {
  return addMesh(parent, new THREE.CylinderGeometry(rTop, rBot, h, segments), mat, pos, rot)
}

/** Segmented solar wing with cell stripes for close-up readability. */
function addSolarWing(
  parent: THREE.Object3D,
  length: number,
  width: number,
  thickness: number,
  pos: [number, number, number],
  axis: 'x' | 'z' = 'x',
  segments = 4,
) {
  const group = new THREE.Group()
  group.position.set(...pos)
  const dark = darkMetal()
  const cell = panelCell()
  const frame = panelMat()
  const segLen = length / segments
  for (let i = 0; i < segments; i++) {
    const along = -length * 0.5 + segLen * (i + 0.5)
    if (axis === 'x') {
      addBox(group, segLen * 0.96, thickness, width * 0.92, cell, [along, 0, 0])
      addBox(group, segLen * 0.02, thickness * 1.4, width, dark, [along + segLen * 0.48, 0, 0])
    } else {
      addBox(group, width * 0.92, thickness, segLen * 0.96, cell, [0, 0, along])
      addBox(group, width, thickness * 1.4, segLen * 0.02, dark, [0, 0, along + segLen * 0.48])
    }
  }
  if (axis === 'x') {
    addBox(group, length * 1.02, thickness * 0.6, width * 0.06, frame, [0, 0, width * 0.48])
    addBox(group, length * 1.02, thickness * 0.6, width * 0.06, frame, [0, 0, -width * 0.48])
  } else {
    addBox(group, width * 0.06, thickness * 0.6, length * 1.02, frame, [width * 0.48, 0, 0])
    addBox(group, width * 0.06, thickness * 0.6, length * 1.02, frame, [-width * 0.48, 0, 0])
  }
  parent.add(group)
  return group
}

function addDish(
  parent: THREE.Object3D,
  radius: number,
  mat: THREE.Material,
  pos: [number, number, number],
  rot?: [number, number, number],
) {
  // Shallow parabolic dish from a sphere cap
  const dish = addMesh(
    parent,
    new THREE.SphereGeometry(radius, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.42),
    mat,
    pos,
    rot,
  )
  // Feed horn
  const feed = addCyl(parent, radius * 0.04, radius * 0.06, radius * 0.35, darkMetal(), [
    pos[0],
    pos[1] + (rot ? 0 : radius * 0.18),
    pos[2],
  ])
  if (rot) feed.rotation.set(...rot)
  return dish
}

function buildIss(): THREE.Group {
  const root = new THREE.Group()
  const white = whiteBus()
  const dark = darkMetal()
  const foil = goldFoil()
  const rad = radiators()

  // Integrated truss (ITS) along +X
  addBox(root, 4.2, 0.22, 0.22, dark, [0, 0, 0])
  for (const x of [-1.6, -0.8, 0, 0.8, 1.6]) {
    addBox(root, 0.08, 0.35, 0.35, dark, [x, 0, 0])
  }

  // Habitable modules along Z ( Destiny / Unity / Zarya / Zvezda approx )
  addCyl(root, 0.28, 0.28, 0.85, white, [0, 0, 0.15], [Math.PI / 2, 0, 0], 24) // Unity node
  addCyl(root, 0.26, 0.26, 1.1, white, [0, 0, -0.75], [Math.PI / 2, 0, 0], 24) // Destiny
  addCyl(root, 0.24, 0.24, 0.9, foil, [0, 0, 0.95], [Math.PI / 2, 0, 0], 24) // Zarya
  addCyl(root, 0.22, 0.22, 0.85, white, [0, 0, 1.75], [Math.PI / 2, 0, 0], 24) // Zvezda
  addCyl(root, 0.2, 0.2, 0.55, white, [0.55, 0, 0.15], [0, 0, Math.PI / 2], 20) // Columbus
  addCyl(root, 0.2, 0.2, 0.55, white, [-0.55, 0, 0.15], [0, 0, Math.PI / 2], 20) // Kibo

  // Cupola under Node
  addMesh(root, new THREE.CylinderGeometry(0.16, 0.2, 0.18, 8), white, [0, -0.28, 0.15])

  // Radiators on truss
  for (const x of [-1.2, 1.2]) {
    addBox(root, 0.05, 0.9, 0.55, rad, [x, 0.55, 0])
  }

  // Four solar array wings (P4/P6 / S4/S6 style)
  for (const side of [-1, 1]) {
    for (const bay of [-1.55, 1.55]) {
      addBox(root, 0.12, 0.12, 0.12, dark, [bay, 0, 0])
      addSolarWing(root, 1.7, 0.55, 0.025, [bay + side * 1.05, 0.02, 0], 'x', 5)
    }
  }

  // Canadarm-ish boom
  addCyl(root, 0.025, 0.025, 1.2, dark, [0.35, 0.25, -0.2], [0, 0, Math.PI / 2.8])

  return root
}

function buildHubble(): THREE.Group {
  const root = new THREE.Group()
  const tube = metal(0xc5cad2, 0x000000, 0, 0.55, 0.4)
  const dark = darkMetal()
  const foil = goldFoil()

  // Optical tube assembly
  addCyl(root, 0.32, 0.34, 1.85, tube, [0, 0, 0], [0, 0, Math.PI / 2], 28)
  // Aperture door (open)
  addBox(root, 0.02, 0.55, 0.55, dark, [1.05, 0.28, 0], [0, 0, -0.4])
  // Light baffle / aperture
  addMesh(
    root,
    new THREE.CircleGeometry(0.26, 28),
    new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1, roughness: 0.9 }),
    [0.93, 0, 0],
    [0, Math.PI / 2, 0],
  )
  // Aft shroud
  addCyl(root, 0.34, 0.3, 0.35, foil, [-1.05, 0, 0], [0, 0, Math.PI / 2], 20)
  // Solar arrays (two wings)
  addSolarWing(root, 0.08, 1.7, 0.02, [0, 0, 0.55], 'z', 6)
  addSolarWing(root, 0.08, 1.7, 0.02, [0, 0, -0.55], 'z', 6)
  // High-gain antennas
  for (const z of [-0.55, 0.55]) {
    addCyl(root, 0.015, 0.015, 0.55, dark, [-0.35, 0.35, z * 0.4], [0.6, 0, 0])
    addDish(root, 0.14, whiteBus(), [-0.35, 0.62, z * 0.55], [Math.PI, 0, 0])
  }
  // Equipment section boxes
  addBox(root, 0.35, 0.28, 0.4, dark, [-0.55, -0.28, 0])

  return root
}

function buildJwst(): THREE.Group {
  const root = new THREE.Group()
  const gold = metal(0xd4a84b, 0x664410, 0.25, 0.9, 0.25)
  const dark = darkMetal()
  const shield = new THREE.MeshStandardMaterial({
    color: 0xe6e2d8,
    metalness: 0.12,
    roughness: 0.55,
    side: THREE.DoubleSide,
  })
  const silver = metal(0xc8ccd2, 0x000000, 0, 0.75, 0.3)

  // Primary mirror — 18 hexagonal segments (approx as hex cylinder clusters)
  const mirror = new THREE.Group()
  mirror.position.set(0, 0.55, 0)
  const hexR = 0.16
  const layout: [number, number][] = [[0, 0]]
  for (let ring = 1; ring <= 2; ring++) {
    for (let i = 0; i < 6 * ring; i++) {
      const a = (i / (6 * ring)) * Math.PI * 2 + (ring === 2 ? Math.PI / 6 : 0)
      layout.push([Math.cos(a) * hexR * 1.75 * ring, Math.sin(a) * hexR * 1.75 * ring])
    }
  }
  for (const [x, z] of layout.slice(0, 18)) {
    const seg = addMesh(mirror, new THREE.CylinderGeometry(hexR, hexR, 0.04, 6), gold, [x, 0, z])
    seg.rotation.x = Math.PI / 2
  }
  root.add(mirror)

  // Secondary mirror on tripod
  addCyl(root, 0.012, 0.012, 0.85, silver, [0.35, 0.95, 0.2], [0.35, 0, 0.2])
  addCyl(root, 0.012, 0.012, 0.85, silver, [-0.35, 0.95, 0.2], [0.35, 0, -0.2])
  addCyl(root, 0.012, 0.012, 0.7, silver, [0, 0.95, -0.4], [-0.2, 0, 0])
  addMesh(root, new THREE.CylinderGeometry(0.08, 0.08, 0.03, 6), gold, [0, 1.15, 0], [
    Math.PI / 2,
    0,
    0,
  ])

  // Five-layer sunshield (kite / diamond planform)
  for (let i = 0; i < 5; i++) {
    const s = 1 - i * 0.04
    const layer = addBox(root, 2.4 * s, 0.012, 1.05 * s, shield, [0, -0.15 - i * 0.045, 0])
    layer.rotation.y = 0.08
  }

  // Spacecraft bus below shield
  addBox(root, 0.55, 0.45, 0.55, dark, [0, -0.55, 0])
  addSolarWing(root, 1.1, 0.35, 0.02, [0.95, -0.55, 0], 'x', 3)
  // High-gain antenna
  addDish(root, 0.22, whiteBus(), [-0.45, -0.7, 0.2], [Math.PI * 0.7, 0.4, 0])

  return root
}

function buildTiangong(): THREE.Group {
  const root = new THREE.Group()
  const white = whiteBus()
  const dark = darkMetal()
  const foil = goldFoil()

  // Tianhe core module
  addCyl(root, 0.28, 0.28, 1.35, white, [0, 0, 0], [Math.PI / 2, 0, 0], 24)
  addCyl(root, 0.22, 0.22, 0.45, foil, [0, 0, -0.85], [Math.PI / 2, 0, 0], 18)
  // Wentian + Mengtian lab modules
  addCyl(root, 0.24, 0.24, 1.05, white, [0.75, 0, 0.15], [0, 0, Math.PI / 2], 22)
  addCyl(root, 0.24, 0.24, 1.05, white, [-0.75, 0, 0.15], [0, 0, Math.PI / 2], 22)
  // Docking nodes
  addCyl(root, 0.16, 0.16, 0.3, dark, [0, 0, 0.75], [Math.PI / 2, 0, 0], 16)
  // Solar wings on core + labs
  addSolarWing(root, 1.5, 0.42, 0.022, [0, 0, -0.2], 'x', 4)
  addSolarWing(root, 1.2, 0.35, 0.02, [0.75, 0.35, 0.15], 'z', 3)
  addSolarWing(root, 1.2, 0.35, 0.02, [-0.75, 0.35, 0.15], 'z', 3)
  // Robotic arm stub
  addCyl(root, 0.02, 0.02, 0.7, dark, [0.2, 0.28, 0.3], [0.5, 0.3, 0])

  return root
}

function buildGps(): THREE.Group {
  const root = new THREE.Group()
  const bus = metal(0xa8b0ba, 0x000000, 0, 0.55, 0.4)
  const dark = darkMetal()

  addBox(root, 0.55, 0.45, 0.7, bus, [0, 0, 0])
  addBox(root, 0.5, 0.08, 0.15, dark, [0, 0.28, 0.2])
  addSolarWing(root, 2.2, 0.5, 0.02, [0, 0, 0], 'x', 5)
  // L-band antenna farm
  for (const [x, z] of [
    [-0.15, 0.25],
    [0.15, 0.25],
    [0, 0.35],
  ] as [number, number][]) {
    addCyl(root, 0.06, 0.06, 0.08, whiteBus(), [x, 0.3, z])
  }
  addDish(root, 0.18, whiteBus(), [0, -0.15, -0.4], [Math.PI * 0.55, 0, 0])
  return root
}

function buildStarlink(): THREE.Group {
  const root = new THREE.Group()
  const flat = metal(0xeceff3, 0x000000, 0, 0.4, 0.45)
  const dark = darkMetal()
  // Flat-panel phased array body
  addBox(root, 0.85, 0.04, 0.55, flat, [0, 0, 0])
  addBox(root, 0.7, 0.03, 0.4, dark, [0, -0.035, 0])
  // Single articulating solar wing (signature Starlink look)
  addBox(root, 0.08, 0.04, 0.08, dark, [0.5, 0, 0])
  addSolarWing(root, 1.6, 0.5, 0.015, [1.35, 0.02, 0], 'x', 4)
  // Inter-sat laser terminals
  addBox(root, 0.08, 0.06, 0.08, dark, [0.2, 0.05, 0.22])
  addBox(root, 0.08, 0.06, 0.08, dark, [-0.2, 0.05, -0.22])
  return root
}

function buildTerra(): THREE.Group {
  const root = new THREE.Group()
  const bus = whiteBus()
  const dark = darkMetal()
  const foil = goldFoil()

  addBox(root, 0.7, 0.55, 1.1, bus, [0, 0, 0])
  addBox(root, 0.65, 0.2, 0.35, foil, [0, 0.35, 0.2])
  // Instrument bay (MODIS/ASTER/MISR suggestion)
  addBox(root, 0.55, 0.25, 0.4, dark, [0, -0.15, 0.45])
  addCyl(root, 0.12, 0.12, 0.2, dark, [0.2, -0.35, 0.45], [Math.PI / 2, 0, 0])
  // Long single-wing solar array
  addBox(root, 0.15, 0.15, 0.15, dark, [-0.5, 0.1, -0.2])
  addSolarWing(root, 2.4, 0.55, 0.02, [-1.8, 0.1, -0.2], 'x', 6)
  addDish(root, 0.2, whiteBus(), [0.25, 0.1, -0.55], [Math.PI * 0.6, 0.2, 0])
  return root
}

function buildVoyager(): THREE.Group {
  const root = new THREE.Group()
  const dishMat = metal(0xf2f4f7, 0x222222, 0.04, 0.55, 0.35)
  const dark = darkMetal()
  const foil = goldFoil()
  const white = whiteBus()

  // High-gain antenna
  addDish(root, 0.7, dishMat, [0, 0.55, 0], [Math.PI, 0, 0])
  addCyl(root, 0.04, 0.04, 0.35, dark, [0, 0.25, 0])

  // Bus / electronics bays
  addBox(root, 0.45, 0.4, 0.45, white, [0, -0.05, 0])
  addBox(root, 0.5, 0.15, 0.5, foil, [0, -0.28, 0])

  // RTG boom (+X)
  addCyl(root, 0.02, 0.02, 1.5, dark, [0.85, -0.05, 0], [0, 0, Math.PI / 2])
  for (const x of [1.2, 1.45, 1.7]) {
    addCyl(root, 0.1, 0.1, 0.08, foil, [x, -0.05, 0], [0, 0, Math.PI / 2], 12)
  }

  // Science boom
  addCyl(root, 0.015, 0.015, 1.1, dark, [-0.55, 0.1, 0.35], [0.4, 0.5, Math.PI / 3])
  addBox(root, 0.12, 0.08, 0.2, dark, [-1.0, 0.35, 0.65])

  // Magnetometer boom (long thin)
  addCyl(root, 0.01, 0.01, 2.0, dark, [0, 0.15, -1.1], [Math.PI / 2.2, 0, 0])

  // Low-gain antenna
  addCyl(root, 0.05, 0.05, 0.1, white, [0.2, 0.35, 0.2])

  return root
}

function buildNewHorizons(): THREE.Group {
  const root = new THREE.Group()
  const bus = metal(0xc4c8d0, 0x000000, 0, 0.5, 0.4)
  const dark = darkMetal()
  const foil = goldFoil()
  const white = whiteBus()

  // Compact piano-sized bus
  addBox(root, 0.7, 0.65, 0.85, bus, [0, 0, 0])
  addBox(root, 0.68, 0.12, 0.3, foil, [0, 0.35, 0.15])

  // 2.1m high-gain dish
  addDish(root, 0.55, white, [0, 0.15, 0.55], [Math.PI * 0.55, 0, 0])

  // RTG on boom
  addCyl(root, 0.025, 0.025, 0.7, dark, [0.55, -0.1, -0.15], [0, 0, Math.PI / 2.4])
  addCyl(root, 0.12, 0.12, 0.35, foil, [0.95, -0.15, -0.2], [0.2, 0, Math.PI / 2], 14)

  // Antenna / instrument stubs
  addBox(root, 0.15, 0.1, 0.25, dark, [-0.25, 0.2, -0.4])
  addCyl(root, 0.03, 0.03, 0.4, dark, [-0.35, 0.4, 0], [0.5, 0, 0])

  // Thin radioisotope cooling fins
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    addBox(root, 0.02, 0.28, 0.08, dark, [
      0.95 + Math.cos(a) * 0.14,
      -0.15,
      -0.2 + Math.sin(a) * 0.14,
    ])
  }

  return root
}

function buildGeneric(): THREE.Group {
  const root = new THREE.Group()
  addBox(root, 0.45, 0.35, 0.6, whiteBus(), [0, 0, 0])
  addSolarWing(root, 1.6, 0.4, 0.02, [0, 0, 0], 'x', 4)
  addDish(root, 0.2, whiteBus(), [0, 0.15, -0.35], [Math.PI * 0.6, 0, 0])
  return root
}

/** Unit-scale craft meshes (fit roughly in a radius-~1 bounding sphere). */
export function createCraftModel(id: string): THREE.Group {
  const root = new THREE.Group()
  root.name = `${id}_model`

  let model: THREE.Group
  switch (id) {
    case 'iss':
      model = buildIss()
      break
    case 'hubble':
      model = buildHubble()
      break
    case 'jwst':
      model = buildJwst()
      break
    case 'tiangong':
      model = buildTiangong()
      break
    case 'gps':
      model = buildGps()
      break
    case 'starlink':
      model = buildStarlink()
      break
    case 'terra':
      model = buildTerra()
      break
    case 'voyager1':
    case 'voyager2':
      model = buildVoyager()
      break
    case 'newhorizons':
      model = buildNewHorizons()
      break
    default:
      model = buildGeneric()
  }

  root.add(model)

  // Normalize to ~radius 1 and center
  const box = new THREE.Box3().setFromObject(root)
  const size = new THREE.Vector3()
  box.getSize(size)
  const maxDim = Math.max(size.x, size.y, size.z, 1e-3)
  root.scale.setScalar(2 / maxDim)
  const center = new THREE.Vector3()
  box.getCenter(center)
  root.position.sub(center.multiplyScalar(root.scale.x))

  return root
}
