export type AssistantContentSegment =
  | { kind: 'text'; content: string }
  | { kind: 'think'; content: string; open: boolean }

const THINK_OPEN_TAG = '<think>'
const THINK_CLOSE_TAG = '</think>'

export function parseAssistantContent(content: string): AssistantContentSegment[] {
  if (!content) {
    return []
  }

  const segments: AssistantContentSegment[] = []
  let cursor = 0

  while (cursor < content.length) {
    const openIndex = content.indexOf(THINK_OPEN_TAG, cursor)

    if (openIndex === -1) {
      segments.push({ kind: 'text', content: content.slice(cursor) })
      break
    }

    if (openIndex > cursor) {
      segments.push({ kind: 'text', content: content.slice(cursor, openIndex) })
    }

    const thinkStart = openIndex + THINK_OPEN_TAG.length
    const closeIndex = content.indexOf(THINK_CLOSE_TAG, thinkStart)

    if (closeIndex === -1) {
      segments.push({
        kind: 'think',
        content: content.slice(thinkStart),
        open: true,
      })
      cursor = content.length
      break
    }

    segments.push({
      kind: 'think',
      content: content.slice(thinkStart, closeIndex),
      open: false,
    })
    cursor = closeIndex + THINK_CLOSE_TAG.length
  }

  return segments.filter(
    (segment) => segment.kind === 'think' || segment.content.length > 0
  )
}
