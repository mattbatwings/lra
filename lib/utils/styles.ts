import { type StyleInfo } from "../types";
import { capitalizeFirstLetter } from "./strings";

export type StrictStyleInfo = {
  depth: number;
  headerText: string;
  isOrdered: boolean;
};

export function getEffectiveStyle(key: string, schemaStyles?: Record<string, StyleInfo>, recordStyles?: Record<string, StyleInfo>): StrictStyleInfo {
  const recordStyle = Object.hasOwn(recordStyles || {}, key) ? recordStyles![key] : null;
  const schemaStyle = Object.hasOwn(schemaStyles || {}, key) ? schemaStyles![key] : null;

  const style = {
    depth: 2,
    headerText: capitalizeFirstLetter(key),
    isOrdered: false,
  };
  if (schemaStyle) {
    if (schemaStyle.depth !== undefined) style.depth = schemaStyle.depth;
    if (schemaStyle.headerText !== undefined) style.headerText = schemaStyle.headerText;
    if (schemaStyle.isOrdered !== undefined) style.isOrdered = schemaStyle.isOrdered;
  }
  if (recordStyle) {
    if (recordStyle.depth !== undefined) style.depth = recordStyle.depth;
    if (recordStyle.headerText !== undefined) style.headerText = recordStyle.headerText;
    if (recordStyle.isOrdered !== undefined) style.isOrdered = recordStyle.isOrdered;
  }
  return style;
}
