import type { FamilyGraph } from '@/utils/familyGraph'
import { branchPath, branchPathThroughPoint, jitter, partnerDefaultPoint, partnerPath } from '@/utils/lineCurves'
import { birthYear, personFullName } from '@/utils/mappers'
import { LAYOUT_PADDING, NODE_HEIGHT, NODE_WIDTH, computeTreeLayout, type TreeStyle } from '@/utils/treeLayout'
import type { MemberGender, Person } from '@/types/models'

// Exports always render in a fixed light palette, independent of the app's
// current dark/light setting: the output is a document meant to be printed
// or shared with people who never open the app, so it should look the same
// regardless of who generates it or when.
const PALETTE = {
  pageBg: '#fdfbf7',
  cardBg: '#ffffff',
  cardBorder: '#e8dac0',
  ink700: '#1c1912',
  ink500: '#6b6258',
  rootLine: '#86b48b',
  earthLine: '#d99461',
  rootTrunk: '#3f7548',
  earthTrunk: '#8f4f30',
  genderFill: {
    female: '#f4dcc9',
    male: '#dbe8dc',
    other: '#f3ead9',
    unknown: '#f3ead9',
  } satisfies Record<MemberGender, string>,
  genderText: {
    female: '#8f4f30',
    male: '#26492d',
    other: '#3a352c',
    unknown: '#3a352c',
  } satisfies Record<MemberGender, string>,
}

const MAX_RASTER_DIMENSION = 6000

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function initials(person: Person): string {
  const a = person.firstName[0] ?? ''
  const b = person.lastName?.[0] ?? ''
  return (a + b).toUpperCase() || '?'
}

function lerpColor(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  const mix = pa.map((v, i) => Math.round(v + (pb[i] - v) * t))
  return `#${mix.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

function rootsGraphicSvg(x: number, topY: number, bottomY: number, opacity: number): string {
  const c = PALETTE.earthTrunk
  return `<g opacity="${opacity}" stroke="${c}" fill="none" stroke-linecap="round">
    <path d="M ${x} ${bottomY} V ${topY}" stroke-width="14" />
    <path d="M ${x} ${bottomY} C ${x - 40} ${bottomY - 6}, ${x - 74} ${bottomY - 2}, ${x - 104} ${bottomY - 10}" stroke-width="6" />
    <path d="M ${x} ${bottomY} C ${x + 40} ${bottomY - 6}, ${x + 74} ${bottomY - 2}, ${x + 104} ${bottomY - 10}" stroke-width="6" />
    <path d="M ${x} ${bottomY} C ${x - 18} ${bottomY + 4}, ${x - 32} ${bottomY + 10}, ${x - 46} ${bottomY + 16}" stroke-width="4" />
    <path d="M ${x} ${bottomY} C ${x + 18} ${bottomY + 4}, ${x + 32} ${bottomY + 10}, ${x + 46} ${bottomY + 16}" stroke-width="4" />
  </g>`
}

/**
 * Builds a self-contained SVG document of the current tree: no external
 * photo URLs, no CSS variables, no foreignObject — plain shapes and text
 * only. That keeps it lightweight even for very large trees, portable (opens
 * in any browser/image viewer with no network access needed) and safe to
 * rasterize to canvas without CORS/tainting concerns. Photos aren't
 * included; genealogy charts have used name+date-only nodes for this exact
 * reason long before this app existed.
 */
export function buildExportSvg(graph: FamilyGraph, style: TreeStyle, treeName: string): { svg: string; width: number; height: number } {
  const layout = computeTreeLayout(graph, style)

  const effectiveXY = (personId: string, fallbackX: number, fallbackY: number) => {
    const person = graph.people.get(personId)
    if (person?.positionX != null && person?.positionY != null) {
      return { x: person.positionX, y: person.positionY }
    }
    return { x: fallbackX, y: fallbackY }
  }

  // A manually-arranged tree can extend past the automatic layout's bounds,
  // so grow the canvas to fit every card rather than clipping dragged ones.
  let width = Math.max(layout.width, 1)
  let height = Math.max(layout.height, 1)
  for (const node of layout.nodes) {
    const pos = effectiveXY(node.personId, node.x, node.y)
    width = Math.max(width, pos.x + NODE_WIDTH / 2 + LAYOUT_PADDING)
    height = Math.max(height, pos.y + NODE_HEIGHT + LAYOUT_PADDING)
  }

  const parts: string[] = []
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="${PALETTE.pageBg}" />`)
  parts.push(
    `<text x="24" y="40" font-family="Georgia, serif" font-size="22" font-weight="600" fill="${PALETTE.ink700}">${escapeXml(treeName)}</text>`,
  )

  if (style === 'classic' && layout.nodes.length > 0) {
    parts.push(rootsGraphicSvg(width / 2, height - 150, height - 20, 0.14))
  }
  if (style === 'rooted') {
    for (const anchor of layout.rootAnchors) {
      parts.push(rootsGraphicSvg(anchor.x, anchor.edgeY, height - 20, 1))
    }
  }

  const nodesById = new Map(layout.nodes.map((n) => [n.personId, n]))
  /** A specific person's card-edge anchor (top in 'rooted', bottom in 'classic'), override-aware -- used for both the partner line and child branches so they always meet at the same point. */
  const parentAnchor = (personId: string) => {
    const raw = nodesById.get(personId)
    const top = effectiveXY(personId, raw?.x ?? 0, raw?.y ?? 0)
    return { x: top.x, y: style === 'classic' ? top.y + NODE_HEIGHT : top.y }
  }

  const partnerCurveById = new Map(
    graph.relationships
      .filter((r) => r.type === 'partner')
      .map((r) => [r.id, r.curveX != null && r.curveY != null ? { x: r.curveX, y: r.curveY } : null] as const),
  )

  for (const line of layout.partnerLines) {
    const a = parentAnchor(line.aId)
    const b = parentAnchor(line.bId)
    const cp = partnerCurveById.get(line.id) ?? partnerDefaultPoint(a.x, a.y, b.x, b.y, line.id)
    parts.push(
      `<path d="${partnerPath(a.x, a.y, b.x, b.y, cp)}" stroke="${PALETTE.earthLine}" stroke-width="2" stroke-linecap="round" fill="none" />`,
    )
  }

  const maxGeneration = Math.max(0, ...layout.nodes.map((n) => n.generation))

  for (const link of layout.childLinks) {
    const color = lerpColor(PALETTE.earthTrunk, PALETTE.rootTrunk, maxGeneration ? link.childGeneration / maxGeneration : 0)
    const strokeWidth = link.primary ? Math.max(2, 6 - link.childGeneration * 0.7) : 1.5
    const dash = link.primary ? '' : ' stroke-dasharray="2 5"'
    const opacity = link.primary ? 1 : 0.6
    const parentPoints = link.parentIds.map(parentAnchor)
    const parent = {
      x: parentPoints.reduce((sum, p) => sum + p.x, 0) / parentPoints.length,
      y: parentPoints.reduce((sum, p) => sum + p.y, 0) / parentPoints.length,
    }
    const childTopFallback = link.childY - (style === 'classic' ? 0 : NODE_HEIGHT)
    const childTop = effectiveXY(link.childId, link.childX, childTopFallback)
    const child = { x: childTop.x, y: style === 'classic' ? childTop.y : childTop.y + NODE_HEIGHT }
    const persistedBelly = graph.childLinkCurve(link.childId, link.parentKey)
    const d = persistedBelly
      ? branchPathThroughPoint(parent.x, parent.y, child.x, child.y, persistedBelly)
      : branchPath(parent.x, parent.y, child.x, child.y, jitter(link.id))
    parts.push(
      `<path d="${d}" stroke="${link.primary ? color : PALETTE.earthLine}" stroke-width="${strokeWidth}" stroke-linecap="round" opacity="${opacity}"${dash} fill="none" />`,
    )
  }

  for (const rawNode of layout.nodes) {
    const person = graph.people.get(rawNode.personId)
    if (!person) continue
    const node = effectiveXY(rawNode.personId, rawNode.x, rawNode.y)
    const cardX = node.x - NODE_WIDTH / 2
    const cardY = node.y
    const avatarCx = node.x
    const avatarCy = node.y + 38
    const avatarR = 26
    const name = personFullName(person) || '—'
    const year = birthYear(person)
    const deathYear = person.deathDate ? new Date(person.deathDate).getFullYear() : null
    const dateLabel = year
      ? deathYear
        ? `${year}–${deathYear}`
        : `b. ${year}`
      : deathYear
        ? `d. ${deathYear}`
        : ''

    parts.push(
      `<rect x="${cardX}" y="${cardY}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="16" fill="${PALETTE.cardBg}" stroke="${PALETTE.cardBorder}" />`,
    )
    parts.push(
      `<circle cx="${avatarCx}" cy="${avatarCy}" r="${avatarR}" fill="${PALETTE.genderFill[person.gender]}" />`,
    )
    parts.push(
      `<text x="${avatarCx}" y="${avatarCy + 6}" text-anchor="middle" font-family="Inter, sans-serif" font-size="18" font-weight="600" fill="${PALETTE.genderText[person.gender]}">${escapeXml(initials(person))}</text>`,
    )
    parts.push(
      `<text x="${node.x}" y="${cardY + 90}" text-anchor="middle" font-family="Inter, sans-serif" font-size="13" font-weight="600" fill="${PALETTE.ink700}">${escapeXml(name)}</text>`,
    )
    if (dateLabel) {
      parts.push(
        `<text x="${node.x}" y="${cardY + 108}" text-anchor="middle" font-family="Inter, sans-serif" font-size="11" fill="${PALETTE.ink500}">${escapeXml(dateLabel)}</text>`,
      )
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join('\n')}</svg>`
  return { svg, width, height }
}

function svgToCanvas(svg: string, width: number, height: number, scale: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Canvas is not supported in this browser.'))
      return
    }
    const image = new Image()
    image.onload = () => {
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas)
    }
    image.onerror = () => reject(new Error('Could not render the tree to an image.'))
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

/** Scale factor kept under a safe raster ceiling so huge trees don't blow past browser canvas limits or memory. */
function safeScale(width: number, height: number, desired: number): number {
  const limited = Math.min(desired, MAX_RASTER_DIMENSION / width, MAX_RASTER_DIMENSION / height)
  return Math.max(0.25, Math.min(desired, limited))
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9À-ɏЀ-ӿ]+/gi, '-').replace(/^-+|-+$/g, '') || 'koreni'
}

export function exportTreeAsSvg(graph: FamilyGraph, style: TreeStyle, treeName: string) {
  const { svg } = buildExportSvg(graph, style, treeName)
  downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${slugify(treeName)}.svg`)
}

// 3x the layout's CSS-px coordinates lands near 216 DPI at the card's printed
// size (72pt/in base, see the PDF export below) -- close to real print
// quality, while still staying well under MAX_RASTER_DIMENSION for all but
// very large trees.
const RASTER_SCALE = 3

export async function exportTreeAsPng(graph: FamilyGraph, style: TreeStyle, treeName: string) {
  const { svg, width, height } = buildExportSvg(graph, style, treeName)
  const scale = safeScale(width, height, RASTER_SCALE)
  const canvas = await svgToCanvas(svg, width, height, scale)
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed.'))), 'image/png'),
  )
  downloadBlob(blob, `${slugify(treeName)}.png`)
}

const A4_PT = { width: 595.28, height: 841.89 }
/** Printable-edge safety margin, and where each tile's page-position label sits. */
const TILE_MARGIN = 28
/** How much adjacent tiles overlap, so slightly-misaligned edges still line up when trimmed and taped. */
const TILE_OVERLAP = 30

/** Start offsets (in world/content units) for tiles covering `total`, each `tileSize` wide, `strideSize` apart. The last tile is pulled back flush with the far edge instead of leaving a near-empty trailing tile. */
function computeTileStarts(total: number, tileSize: number, strideSize: number): number[] {
  if (total <= tileSize) return [0]
  const starts: number[] = []
  let pos = 0
  while (pos + tileSize < total) {
    starts.push(pos)
    pos += strideSize
  }
  starts.push(Math.max(0, total - tileSize))
  return starts
}

function parseSvgElement(svg: string): Element {
  return new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement
}

const tileLabel = (row: number, col: number) => `${row + 1}${String.fromCharCode(65 + col)}`

/**
 * 1 layout px = 1 pt, so the tree is laid out at its true physical print
 * size. A small tree gets a single page sized to fit it exactly, like a
 * poster sheet. A large one is split into a grid of A4 pages with an
 * overlap margin and position labels, so it can be printed at a normal
 * copy shop or home printer and assembled by hand -- plus a lead page
 * showing the whole tree with the grid overlaid, as an assembly map.
 */
export async function exportTreeAsPdf(graph: FamilyGraph, style: TreeStyle, treeName: string) {
  const { svg, width, height } = buildExportSvg(graph, style, treeName)
  const [{ jsPDF }] = await Promise.all([import('jspdf'), import('svg2pdf.js')])

  const landscape = width >= height
  const pageWidth = landscape ? A4_PT.height : A4_PT.width
  const pageHeight = landscape ? A4_PT.width : A4_PT.height
  const tileContentWidth = pageWidth - TILE_MARGIN * 2
  const tileContentHeight = pageHeight - TILE_MARGIN * 2

  if (width <= tileContentWidth && height <= tileContentHeight) {
    const pdf = new jsPDF({
      orientation: landscape ? 'landscape' : 'portrait',
      unit: 'pt',
      format: [width + TILE_MARGIN * 2, height + TILE_MARGIN * 2],
    })
    await pdf.svg(parseSvgElement(svg), { x: TILE_MARGIN, y: TILE_MARGIN, width, height })
    pdf.save(`${slugify(treeName)}.pdf`)
    return
  }

  const colStarts = computeTileStarts(width, tileContentWidth, tileContentWidth - TILE_OVERLAP)
  const rowStarts = computeTileStarts(height, tileContentHeight, tileContentHeight - TILE_OVERLAP)
  const pageCount = colStarts.length * rowStarts.length

  const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt', format: [pageWidth, pageHeight] })

  // Lead page: a shrunk-to-fit overview with the tile grid overlaid.
  const overviewScale = Math.min(tileContentWidth / width, tileContentHeight / height)
  const overviewWidth = width * overviewScale
  const overviewHeight = height * overviewScale
  const overviewX = TILE_MARGIN + (tileContentWidth - overviewWidth) / 2
  const overviewY = TILE_MARGIN + (tileContentHeight - overviewHeight) / 2
  await pdf.svg(parseSvgElement(svg), { x: overviewX, y: overviewY, width: overviewWidth, height: overviewHeight })
  pdf.setDrawColor(200, 80, 40)
  pdf.setLineWidth(0.75)
  for (const c of colStarts) {
    if (c === 0) continue
    const x = overviewX + c * overviewScale
    pdf.line(x, overviewY, x, overviewY + overviewHeight)
  }
  for (const r of rowStarts) {
    if (r === 0) continue
    const y = overviewY + r * overviewScale
    pdf.line(overviewX, y, overviewX + overviewWidth, y)
  }
  pdf.setFontSize(8)
  pdf.setTextColor(120, 60, 30)
  rowStarts.forEach((r, ri) => {
    colStarts.forEach((c, ci) => {
      pdf.text(tileLabel(ri, ci), overviewX + c * overviewScale + 3, overviewY + r * overviewScale + 10)
    })
  })
  pdf.setFontSize(10)
  pdf.setTextColor(30, 25, 18)
  pdf.text(
    `${treeName} — print all ${pageCount} following pages at 100% scale (not "fit to page"), then trim and align the overlapping edges using the labels above.`,
    TILE_MARGIN,
    pageHeight - TILE_MARGIN / 2,
    { maxWidth: pageWidth - TILE_MARGIN * 2 },
  )

  for (let ri = 0; ri < rowStarts.length; ri++) {
    for (let ci = 0; ci < colStarts.length; ci++) {
      pdf.addPage([pageWidth, pageHeight], landscape ? 'landscape' : 'portrait')
      await pdf.svg(parseSvgElement(svg), { x: TILE_MARGIN - colStarts[ci], y: TILE_MARGIN - rowStarts[ri], width, height })
      pdf.setFontSize(8)
      pdf.setTextColor(120, 60, 30)
      pdf.text(`${treeName} — ${tileLabel(ri, ci)} (page ${ri * colStarts.length + ci + 2} of ${pageCount + 1})`, TILE_MARGIN, 16)
    }
  }

  pdf.save(`${slugify(treeName)}.pdf`)
}
