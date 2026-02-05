import { AuthorType, type AllAuthorPropertiesAccessor, type Author } from "../types";

export function getAuthorName(author: Author): string {
  if (author.type === AuthorType.DiscordInGuild || author.type === AuthorType.DiscordLeftGuild) {
    return author.displayName;
  }
  return author.username;
}

export function getAuthorIconURL(author: Author): string | undefined {
  return (author as AllAuthorPropertiesAccessor).iconURL;
}
