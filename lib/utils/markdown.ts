import { type NestedListItem, type StyleInfo, type SubmissionRecord, type SubmissionRecords } from "../types";
import { getEffectiveStyle } from "./styles";

export function nestedListToMarkdown(nestedList: NestedListItem, indentLevel: number = 0): string {
  const markdown: string[] = [];
  const indent = "  ".repeat(indentLevel);
  if (nestedList.isOrdered) {
    nestedList.items.forEach((item, index) => {
      if (typeof item === "string") {
        markdown.push(`${indent}${index + 1}. ${item}`);
      } else if (typeof item === "object") {
        markdown.push(`${indent}${index + 1}. ${item.title}`);
        if (item.items.length > 0) {
          markdown.push(nestedListToMarkdown(item, indentLevel + 2));
        }
      }
    });
  } else {
    nestedList.items.forEach((item) => {
      if (typeof item === "string") {
        markdown.push(`${indent}- ${item}`);
      } else if (typeof item === "object") {
        markdown.push(`${indent}- ${item.title}`);
        if (item.items.length > 0) {
          markdown.push(nestedListToMarkdown(item, indentLevel + 1));
        }
      }
    });
  }
  return markdown.join("\n");
}

export function submissionRecordToMarkdown(value: SubmissionRecord, style?: StyleInfo): string {
  let markdown = "";
  if (Array.isArray(value)) {
    if (value.length !== 0) {
      markdown += value
        .map((item, i) => {
          if (typeof item === "string") {
            return style?.isOrdered ? `${i + 1}. ${item}` : `- ${item}`;
          } else if (typeof item === "object") {
            return style?.isOrdered ? `${i + 1}. ${item.title}\n${nestedListToMarkdown(item, 2)}` : `- ${item.title}\n${nestedListToMarkdown(item, 1)}`;
          }
          return "";
        })
        .join("\n");
    }
  } else {
    markdown += `${value}\n`;
  }

  return markdown.trim();
}

export function postToMarkdown(record: SubmissionRecords, recordStyles?: Record<string, StyleInfo>, schemaStyles?: Record<string, StyleInfo>): string {
  let markdown = "";

  let isFirst = true;

  const parentsRecorded = new Set<string>();
  for (const key in record) {
    const keyParts = key.split(":");
    for (let i = keyParts.length - 1; i > 0; i--) {
      const parentKey = keyParts.slice(0, i).join(":");
      if (!parentsRecorded.has(parentKey)) {
        const parentStyle = getEffectiveStyle(parentKey, schemaStyles, recordStyles);
        markdown += `\n${"#".repeat(parentStyle.depth)} ${parentStyle.headerText}\n`;
        parentsRecorded.add(parentKey);
      } else {
        break;
      }
    }

    parentsRecorded.add(key);

    const recordValue = record[key];
    const styles = getEffectiveStyle(key, schemaStyles, recordStyles);

    const text = submissionRecordToMarkdown(recordValue, styles);
    if (text.length > 0) {
      if (key !== "description" || !isFirst) {
        markdown += `\n${"#".repeat(styles.depth)} ${styles.headerText}\n`;
      }
      isFirst = false;
    }
    markdown += text;
  }

  return markdown.trim();
}
