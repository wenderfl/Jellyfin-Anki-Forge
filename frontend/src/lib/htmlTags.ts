export function preserveHtmlTags(original: string, updated: string): string {
  if (!original || !updated) {
    return updated.trim();
  }

  const taggedSegments = extractTaggedSegments(original);
  if (taggedSegments.length === 0) {
    return updated.trim();
  }

  let result = updated.trim();
  for (const segment of taggedSegments) {
    const searchText = segment.innerText.trim();
    if (!searchText) {
      continue;
    }

    const position = result.indexOf(searchText);
    if (position !== -1) {
      const before = result.substring(0, position);
      const after = result.substring(position + searchText.length);
      result = `${before}${segment.openTag}${searchText}${segment.closeTag}${after}`;
    }
  }

  return result;
}

interface TaggedSegment {
  openTag: string;
  closeTag: string;
  innerText: string;
}

function extractTaggedSegments(text: string): TaggedSegment[] {
  const segments: TaggedSegment[] = [];
  const pattern = /<([a-zA-Z][a-zA-Z0-9]*)(?:\s[^>]*)?>([^<]*)<\/\1>/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const tagName = match[1];
    if (!tagName) {
      continue;
    }

    const openTag = match[0].substring(0, match[0].indexOf('>') + 1);
    const innerText = match[2] ?? '';
    segments.push({ openTag, closeTag: `</${tagName}>`, innerText });
  }

  return segments;
}
