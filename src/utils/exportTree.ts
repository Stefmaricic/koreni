import type { FamilyGraph } from '@/utils/familyGraph'
import { birthYear, personFullName } from '@/utils/mappers'
import { NODE_HEIGHT, NODE_WIDTH, computeTreeLayout, type TreeStyle } from '@/utils/treeLayout'
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
  const width = Math.max(layout.width, 1)
  const height = Math.max(layout.height, 1)

  const parts: string[] = []
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="${PALETTE.pageBg}" />`)
  parts.push(
    `<text x="24" y="40" font-family="Georgia, serif" font-size="22" font-weight="600" fill="${PALETTE.ink700}">${escapeXml(treeName)}</text>`,
  )

  if (style === 'classic' && layout.nodes.length > 0) {
    parts.push(rootsGraphicSvg(width / 2, height - 150, height - 20, 0.14))
  }

  const rootNodes = layout.nodes.filter((n) => n.generation === 0)
  if (style === 'rooted' && rootNodes.length > 0) {
    const x = rootNodes.reduce((sum, n) => sum + n.x, 0) / rootNodes.length
    const edgeY = Math.min(...rootNodes.map((n) => n.y)) + NODE_HEIGHT
    parts.push(rootsGraphicSvg(x, edgeY, height - 20, 1))
  }

  for (const line of layout.partnerLines) {
    parts.push(`<line x1="${line.x1}" x2="${line.x2}" y1="${line.y}" y2="${line.y}" stroke="${PALETTE.earthLine}" stroke-width="3" />`)
  }

  const maxGeneration = Math.max(0, ...layout.nodes.map((n) => n.generation))
  const genByPerson = new Map(layout.nodes.map((n) => [n.personId, n.generation]))

  if (style === 'classic') {
    for (const edge of layout.childEdges) {
      parts.push(`<g stroke="${PALETTE.rootLine}" stroke-width="2.5" fill="none">`)
      parts.push(`<line x1="${edge.parentX}" y1="${edge.parentY}" x2="${edge.parentX}" y2="${edge.busY}" />`)
      if (edge.children.length > 1) {
        const minX = Math.min(edge.parentX, ...edge.children.map((c) => c.x))
        const maxX = Math.max(edge.parentX, ...edge.children.map((c) => c.x))
        parts.push(`<line x1="${minX}" y1="${edge.busY}" x2="${maxX}" y2="${edge.busY}" />`)
      }
      for (const c of edge.children) {
        parts.push(`<line x1="${c.x}" y1="${edge.busY}" x2="${c.x}" y2="${c.topY}" />`)
      }
      parts.push('</g>')
    }
  } else {
    for (const edge of layout.childEdges) {
      for (const c of edge.children) {
        const gen = genByPerson.get(c.personId) ?? 0
        const color = lerpColor(PALETTE.earthTrunk, PALETTE.rootTrunk, maxGeneration ? gen / maxGeneration : 0)
        const midY = (edge.parentY + c.topY) / 2
        const strokeWidth = Math.max(2, 6 - gen * 0.7)
        parts.push(
          `<path d="M ${edge.parentX} ${edge.parentY} C ${edge.parentX} ${midY}, ${c.x} ${midY}, ${c.x} ${c.topY}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none" />`,
        )
      }
    }
  }

  for (const node of layout.nodes) {
    const person = graph.people.get(node.personId)
    if (!person) continue
    const cardX = node.x - NODE_WIDTH / 2
    const cardY = node.y
    const avatarCx = node.x
    const avatarCy = node.y + 38
    const avatarR = 26
    const name = personFullName(person) || '—'
    const year = birthYear(person)
    const deathYear = person.deathDate ? new Date(person.deathDate).getFullYear() : null
    const dateLabel = year ? (deathYear ? `${year}–${deathYear}` : `b. ${year}`) : ''

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

export async function exportTreeAsPng(graph: FamilyGraph, style: TreeStyle, treeName: string) {
  const { svg, width, height } = buildExportSvg(graph, style, treeName)
  const scale = safeScale(width, height, 2)
  const canvas = await svgToCanvas(svg, width, height, scale)
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed.'))), 'image/png'),
  )
  downloadBlob(blob, `${slugify(treeName)}.png`)
}

export async function exportTreeAsPdf(graph: FamilyGraph, style: TreeStyle, treeName: string) {
  const { svg, width, height } = buildExportSvg(graph, style, treeName)
  const scale = safeScale(width, height, 2)
  const canvas = await svgToCanvas(svg, width, height, scale)
  const imageData = canvas.toDataURL('image/jpeg', 0.92)

  // 1 layout px = 1 pt: for a large tree this is a physically large ("poster")
  // page rather than forcing everything to fit on A4, so nothing shrinks to
  // the point of being unreadable.
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({
    orientation: width >= height ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [width, height],
  })
  pdf.addImage(imageData, 'JPEG', 0, 0, width, height)
  pdf.save(`${slugify(treeName)}.pdf`)
}
