import { ReferenceType, type Reference } from "../types";
import { buildDictionarySlug } from "../dictionary";
import { getAuthorName } from "./authors";
import { buildEntrySlugFromReference } from "../archive";

export type RegexMatch = {
  pattern: string;
  match: string;
  start: number;
  end: number;
  groups: (string | undefined)[];
};

export type Snowflake = string;

export type ServerLinksMap = Map<Snowflake, { id: Snowflake; name: string; joinURL: string }>;

export const DiscordForumLinkPattern = /https?:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/channels\/(\d+)\/(\d+)(?:\/(\d+))?/g;

export function findRegexMatches(text: string, patterns: RegExp[]): RegexMatch[] {
  const results: RegexMatch[] = [];
  for (const pattern of patterns) {
    if (!pattern.global) {
      const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
      const globalPattern = new RegExp(pattern.source, flags);
      collectMatches(globalPattern);
    } else {
      collectMatches(pattern);
    }
  }
  return results;

  function collectMatches(regex: RegExp) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const matched = match[0];
      const start = match.index;
      results.push({
        pattern: regex.source,
        match: matched,
        start,
        end: start + matched.length,
        groups: match.slice(1),
      });
      if (match[0].length === 0) {
        regex.lastIndex++;
      }
    }
  }
}

function shouldIncludeMatch(text: string, term: string, start: number, end: number): boolean {
  const isTermAllCaps = term.toUpperCase() === term;
  const matchedText = text.slice(start, end);

  if (isTermAllCaps && matchedText !== term) {
    return false;
  }

  const before = start > 0 ? text[start - 1] : undefined;
  const after = end < text.length ? text[end] : undefined;

  if (/^[0-9]/.test(term)) {
    if (before && /[0-9.]/.test(before)) {
      return false;
    }
  }

  if (/[0-9x.]$/.test(term)) {
    if (after && /[0-9]/.test(after)) {
      return false;
    }
  }

  const isWordChar = (ch: string | undefined): boolean => {
    return ch !== undefined && /[A-Za-z]/.test(ch);
  };

  const startSatisfied = isWordChar(before) === false;
  let endingSatisfied = isWordChar(after) === false;

  if (startSatisfied && endingSatisfied) {
    return true;
  }

  const lastWord = term.split(" ").pop() || "";
  const hasNoNumbers = !/[0-9]/.test(lastWord);

  if (hasNoNumbers && startSatisfied && !endingSatisfied) {
    const getSliceAtEnd = (len: number): string => {
      return text.slice(end, Math.min(end + len, text.length));
    };
    const getCharAt = (pos: number): string | undefined => {
      pos += end;
      return pos < text.length ? text[pos] : undefined;
    };

    if (getCharAt(0) === "s" && !isWordChar(getCharAt(1))) {
      endingSatisfied = true;
    } else if (getSliceAtEnd(2) === "ed" && !isWordChar(getCharAt(2))) {
      endingSatisfied = true;
    } else if (getSliceAtEnd(3) === "ing" && !isWordChar(getCharAt(3))) {
      endingSatisfied = true;
    } else if (getSliceAtEnd(2) === "er" && !isWordChar(getCharAt(2))) {
      endingSatisfied = true;
    } else if (getSliceAtEnd(3) === "est" && !isWordChar(getCharAt(3))) {
      endingSatisfied = true;
    }

    if (endingSatisfied) {
      return true;
    }
  }

  return false;
}

export function findMatchesWithinText(
  text: string,
  references: Reference[],
): {
  reference: Reference;
  start: number;
  end: number;
}[] {
  const matches: {
    reference: Reference;
    start: number;
    end: number;
  }[] = [];

  for (const ref of references) {
    for (const matchText of ref.matches) {
      let startIndex = 0;
      while (startIndex < text.length) {
        const index = text.indexOf(matchText, startIndex);
        if (index === -1) break;
        matches.push({
          reference: ref,
          start: index,
          end: index + matchText.length,
        });
        startIndex = index + matchText.length;
      }
    }
  }

  return matches;
}


export function transformOutputWithReferencesWrapper(
  text: string,
  references: Reference[],
  replaceFunction: (reference: Reference, matchedText: string, isHeader: boolean, isWithinHyperlink: boolean, hyperlinkText?: string, hyperlinkURL?: string, hyeperlinkTitle?: string) => string | undefined,
): string {
  const matches = findMatchesWithinText(text, references);
  if (matches.length === 0) {
    return text;
  }

  const filteredMatches = matches.filter(({ start, end }) => {
    return shouldIncludeMatch(text, text.slice(start, end), start, end);
  });

  filteredMatches.sort((a, b) => a.start - b.start);

  // collect duplicate/overlapping matches
  const groupedMatches: typeof matches[] = [];
  let currentGroup: typeof matches = [];
  let lastEnd = -1;
  for (const match of filteredMatches) {
    if (match.start >= lastEnd) {
      if (currentGroup.length > 0) {
        groupedMatches.push(currentGroup);
      }
      currentGroup = [match];
    } else {
      currentGroup.push(match);
    }
    lastEnd = Math.max(lastEnd, match.end);
  }
  if (currentGroup.length > 0) {
    groupedMatches.push(currentGroup);
  }

  // from each group, pick the longest match
  const dedupedMatches: typeof matches = groupedMatches.map(group => {
    return group.reduce((prev, current) => {
      const prevLength = prev.end - prev.start;
      const currentLength = current.end - current.start;
      if (currentLength > prevLength) {
        return current;
      }
      return prev;
    });
  });

  const hyperlinkRegex = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g;
  const hyperlinks = findRegexMatches(text, [hyperlinkRegex]);

  const resultParts: string[] = [];
  let currentIndex = 0;

  for (const match of dedupedMatches) {
    // check if in header (#'s in front)
    let inHeader = false;
    const lastNewline = text.lastIndexOf('\n', match.start);
    if (lastNewline !== -1) {
      const lineStart = lastNewline + 1;
      let i = lineStart;
      while (i < match.start && text[i] === ' ') {
        i++;
      }
      let hashCount = 0;
      while (i < match.start && text[i] === '#') {
        hashCount++;
        i++;
      }
      if (hashCount > 0) {
        inHeader = true;
      }
    }

    // check if match is within a hyperlink
    const hyperlink = hyperlinks.find(h => match.start >= h.start && match.end <= h.end);
    const ref = match.reference;
    const fullMatch = hyperlink ? hyperlink : match;
    const fullMatchedText = text.slice(fullMatch.start, fullMatch.end);

    const replacement = replaceFunction(
      ref,
      fullMatchedText,
      inHeader,
      !!hyperlink,
      hyperlink ? hyperlink.groups[0] : undefined,
      hyperlink ? hyperlink.groups[1] : undefined,
      hyperlink ? hyperlink.groups[2] : undefined
    );

    if (replacement !== undefined) {
      // add text before match
      if (currentIndex < fullMatch.start) {
        resultParts.push(text.slice(currentIndex, fullMatch.start));
      }
      resultParts.push(replacement);
      currentIndex = fullMatch.end;
    }
  }

  // add remaining text
  if (currentIndex < text.length) {
    resultParts.push(text.slice(currentIndex));
  }

  return resultParts.join('');
}

const DiscordLinkPattern = /https?:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/channels\/(\d+)\/(\d+)(?:\/(\d+))?/;

export function transformOutputWithReferencesForWebsite(
  text: string,
  references: Reference[],
  dictionaryTooltipLookup?: (id: string) => string | undefined
): string {
  const excludeSet = new Set<Snowflake>();
  return transformOutputWithReferencesWrapper(
    text,
    references,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (reference, matchedText, isHeader, isWithinHyperlink, hyperlinkText, _hyperlinkURL, hyperlinkTitle) => {
      if (isHeader) {
        return; // skip replacements in headers
      }

      if (reference.type === ReferenceType.DICTIONARY_TERM) {
        // check for repeats
        if (excludeSet.has(reference.id)) {
          return;
        }

        const tooltip = dictionaryTooltipLookup?.(reference.id);
        const safeTitle = tooltip ? tooltip.replace(/"/g, "'").replace(/\n/g, " ").trim() : undefined;
        if (isWithinHyperlink) {
          return; // skip, already linked
        } else {
          const slug = buildDictionarySlug({ id: reference.id, terms: [reference.term] });
          const newURL = `/dictionary/${encodeURIComponent(slug)}`;
          excludeSet.add(reference.id);
          if (safeTitle) {
            return `[${matchedText}](${newURL} "Definition: ${safeTitle}")`;
          } else {
            return `[${matchedText}](${newURL})`;
          }
        }
      } else if (reference.type === ReferenceType.ARCHIVED_POST) {
        const newURL = `/archives/${buildEntrySlugFromReference(reference)}`
        const tooltip = reference.name;
        const safeTitle = tooltip ? tooltip.replace(/"/g, "'").replace(/\n/g, " ").trim() : undefined;
        if (isWithinHyperlink) {
          const linkText = hyperlinkText || "";
          if (linkText.toUpperCase() === reference.code) {
            if (safeTitle) {
              return `[${linkText} ${safeTitle}](${newURL})`;
            } else {
              return `[${linkText}](${newURL})`;
            }
          } else {
            return `[${linkText}](${newURL} "${safeTitle || linkText}")`;
          }
        } else {

          // check if matchedText is a discord url, if so replace
          if (DiscordLinkPattern.test(matchedText.trim())) {
            matchedText = reference.code + (safeTitle ? ` ${safeTitle}` : "");
          } else if (safeTitle) {
            return `[${matchedText}](${newURL} "${safeTitle}")`;
          }

          return `[${matchedText}](${newURL})`;
        }
      } else if (reference.type === ReferenceType.DISCORD_LINK) {
        if (!isWithinHyperlink) {
          matchedText = `[[Link]](${reference.url} "Message ${reference.serverName ? `on ${reference.serverName} Discord` : "on Discord"}")`;
        }
        // add suffix
        return matchedText + (reference.serverName && reference.serverJoinURL
          ? ` ([Join ${reference.serverName}](${reference.serverJoinURL}))`
          : "");
      } else if (reference.type === ReferenceType.USER_MENTION) {
        return getAuthorName(reference.user) || "Unknown User";
      } else if (reference.type === ReferenceType.CHANNEL_MENTION) {
        if (isWithinHyperlink) {
          return; // skip, already linked
        }

        if (reference.channelName && reference.channelURL) {
          return `[#${reference.channelName}](${reference.channelURL})`;
        } else {
          return `[Unknown Channel](# "ID: ${reference.channelID}")`;
        }
      }
      return;
    }
  );
}

export function transformOutputWithReferencesForSocials(
  text: string,
  references: Reference[],
): string {
  return transformOutputWithReferencesWrapper(
    text,
    references,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (reference, matchedText, isHeader, isWithinHyperlink, hyperlinkText, _hyperlinkURL, _hyperlinkTitle) => {
      if (isHeader) {
        return; // skip replacements in headers
      }

      if (reference.type === ReferenceType.DICTIONARY_TERM) {
        return hyperlinkText || matchedText;
      } else if (reference.type === ReferenceType.ARCHIVED_POST) {
        const tooltip = reference.name;
        const safeTitle = tooltip ? tooltip.replace(/"/g, "'").replace(/\n/g, " ").trim() : undefined;
        return reference.code + (safeTitle ? ` ${safeTitle}` : "");
      } else if (reference.type === ReferenceType.DISCORD_LINK) {
        return "[Discord Link]";
      } else if (reference.type === ReferenceType.USER_MENTION) {
        return getAuthorName(reference.user) || "Unknown User";
      } else if (reference.type === ReferenceType.CHANNEL_MENTION) {
        if (reference.channelName && reference.channelURL) {
          return `#${reference.channelName}`;
        } else {
          return `#unknown`;
        }
      }
      return;
    }
  );
}