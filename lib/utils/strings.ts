export function normalize(s?: string) {
  return (s || "").toLowerCase();
}

export function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncateStringWithEllipsis(str: string, maxLength: number): string {
    const ellipsis = '...';

    if (str.length <= maxLength) {
        return str;
    }

    if (maxLength <= ellipsis.length) {
        return ellipsis.slice(0, maxLength);
    }

    const sliceLength = maxLength - ellipsis.length;
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

    let adjusted = str;
    let match: RegExpExecArray | null;

    while ((match = markdownLinkRegex.exec(adjusted)) !== null) {
        const start = match.index;
        const end = start + match[0].length;

        if (start < sliceLength && sliceLength < end) {
            // Remove the Markdown wrapper when the cut would land inside a link.
            adjusted = adjusted.slice(0, start) + match[1] + adjusted.slice(end);

            if (adjusted.length <= maxLength) {
                return adjusted;
            }

            markdownLinkRegex.lastIndex = start;
            continue;
        }

        if (start >= sliceLength) {
            break;
        }
    }

    return adjusted.slice(0, sliceLength) + ellipsis;
}