// Rules for a single post. No file or database access here, so the browser can
// run the same checks live while a draft is being edited.
import twitter from "twitter-text";
import style from "../config/style-rules.json" with { type: "json" };

export const LIMIT = 280;

// Length the way X counts it: a link is 23, an emoji is 2.
export const weighted = (text: string) => twitter.parseTweet(text).weightedLength;

const plain = (s: string) => s.replace(/[‘’]/g, "'").toLowerCase();

// Every rule a post breaks that code can detect. An empty list means it is clean.
export function problems(text: string, allow: { hashtags: boolean; emoji: boolean; banned?: string[] }): string[] {
  const found: string[] = [];
  const length = weighted(text);
  if (length > LIMIT) found.push(`over limit: ${length} of ${LIMIT}`);
  if (text.includes("—")) found.push("em dash");
  if (!allow.hashtags && /(^|\s)#[\p{L}\p{N}_]+/u.test(text)) found.push("hashtag");
  if (!allow.emoji && /\p{Extended_Pictographic}/u.test(text)) found.push("emoji");
  if (/^\s*\(?\d{1,2}\s*[/)]|^\s*\d{1,2}\.\s|\b\d{1,2}\/\d{1,2}\)?\s*$/.test(text)) found.push("thread numbering");
  // The X shape: a hook first line, air between beats, and no link pulling the reader away.
  const first = text.split("\n")[0] ?? "";
  if (weighted(first) > 100) found.push("long hook");
  if (!text.includes("\n") && length > 180) found.push("wall of text");
  if (/https?:\/\/|\bwww\./i.test(text)) found.push("link in post");
  for (const phrase of style.banned_phrases) {
    if (plain(text).includes(plain(phrase))) found.push(`banned phrase: ${phrase}`);
  }
  // Whole words only, any capitalisation: "I" catches "i'm" but not "time".
  for (const word of allow.banned ?? []) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(plain(text))) found.push(`banned word: ${word}`);
  }
  return found;
}
