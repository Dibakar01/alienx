import * as cheerio from "cheerio";
import Parser from "rss-parser";
import type { Account } from "./accounts.ts";
import { type Article, writeArticle } from "./corpus.ts";

const UA = "alienX/0.1 (local single-user ingest)";
const MIN_ARTICLES = 3;

// Everything in a post that is not the author's prose.
const JUNK = [
  "script", "style", "figure", "iframe", "form", "button", "svg", "input", "label",
  ".subscription-widget-wrap", ".subscription-widget-wrap-editor", ".button-wrapper",
  ".captioned-button-wrap", ".captioned-image-container", ".install-substack-app-embed",
  ".digest-post-embed", ".embedded-post-wrap", ".latex-rendered", ".spotify-wrap",
  ".youtube-wrap", ".tweet", ".poll-embed", ".footnote-anchor", ".footnote-number",
].join(",");

// At most one request per second, across every source. A request gives up after 30 seconds.
let last = 0;
async function get(url: string): Promise<Response> {
  const wait = last + 1000 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  return fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30_000) });
}

// The body as text, refused past 5 MB so an endless response cannot fill memory.
const MAX_BYTES = 5 * 1024 * 1024;
export async function body(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (let r = await reader.read(); !r.done; r = await reader.read()) {
    size += r.value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new Error(`${res.url} is larger than 5 MB`);
    }
    parts.push(r.value);
  }
  return Buffer.concat(parts).toString("utf8");
}

// HTML to clean text. Paragraphs are separated by a blank line, line breaks inside
// poems are kept, and block quotes and pull quotes are marked with "> " because
// they can hold someone else's words.
function toText(html: string): string {
  const $ = cheerio.load(html);
  $(JUNK).remove();
  $("br").replaceWith("\n");
  $("li").prepend("- ");
  $("h1,h2,h3,h4,h5,h6").prepend("## ");
  $("p,pre,li,h1,h2,h3,h4,h5,h6,div").append("\n\n");
  $("blockquote,.pullquote").each((_, el) => {
    const lines = $(el).text().split("\n").map((l) => l.trim()).filter(Boolean);
    $(el).text(lines.map((l) => `> ${l}`).join("\n") + "\n\n");
  });
  return $("body")
    .text()
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const clean = (url: string) => url.split(/[?#]/)[0]!.replace(/\/+$/, "");

function fromPage(html: string, url: string): Article {
  const $ = cheerio.load(html);
  const title = ($("h1.post-title").first().text() || $('meta[property="og:title"]').attr("content") || "").trim();
  let date = $('meta[property="article:published_time"]').attr("content") ?? "";
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      date ||= JSON.parse($(el).text()).datePublished ?? "";
    } catch {
      // not JSON we can use
    }
  });
  const body = $(".body.markup").first().html() ?? $("article").first().html() ?? "";
  return { title, url, date: date.slice(0, 10), body: toText(body) };
}

type IngestReport ={ handle: string; feed: number; sitemap: number; skipped: string[]; warnings: string[] };

// Reads {base}/feed, then {base}/sitemap.xml for posts the feed no longer carries.
// Throws rather than continue on a failed feed or a source with too few articles.
export async function ingest(account: Account): Promise<IngestReport> {
  if (!account.source_url) throw new Error(`${account.handle}: no source_url`);
  const base = clean(account.source_url);
  const report: IngestReport = { handle: account.handle, feed: 0, sitemap: 0, skipped: [], warnings: [] };
  const seen = new Set<string>();
  const excluded = new Set((account.exclude_urls ?? []).map(clean));

  const keep = (a: Article, from: "feed" | "sitemap") => {
    seen.add(a.url);
    if (excluded.has(a.url)) return;
    // Too short to be a piece of writing: an audio-only or image-only post.
    if (words(a.body) < 20) return void report.skipped.push(a.url);
    writeArticle(account.handle, a);
    report[from]++;
  };

  const feedRes = await get(`${base}/feed`);
  if (!feedRes.ok) throw new Error(`${account.handle}: feed returned ${feedRes.status}`);
  const feed = await new Parser().parseString(await body(feedRes));
  for (const item of feed.items) {
    if (!item.link) continue;
    keep(
      {
        title: (item.title ?? "").trim(),
        url: clean(item.link),
        date: (item.isoDate ?? "").slice(0, 10),
        body: toText(item["content:encoded"] ?? item.content ?? ""),
      },
      "feed",
    );
  }

  const mapRes = await get(`${base}/sitemap.xml`);
  if (!mapRes.ok) {
    report.warnings.push(`sitemap returned ${mapRes.status}, so only the feed was read`);
  } else {
    const $ = cheerio.load(await body(mapRes), { xml: true });
    // Only pages on the blog's own site, as reached after redirects (a Substack with its own
    // domain redirects there), so a sitemap cannot send requests to other hosts.
    const origin = new URL(mapRes.url).origin;
    const ours = (u: string) => URL.parse(u)?.origin === origin;
    // ponytail: Substack post URLs only (/p/). Other blogs get their feed alone;
    // widen this when a non-Substack source needs its archive.
    const older = $("loc").map((_, el) => clean($(el).text().trim())).get().filter((u) => u.includes("/p/") && ours(u) && !seen.has(u) && !excluded.has(u));
    for (const url of older) {
      const res = await get(url);
      if (!res.ok) throw new Error(`${account.handle}: ${url} returned ${res.status}`);
      if (!ours(res.url)) {
        report.warnings.push(`${url} redirected off the blog, so it was skipped`);
        continue;
      }
      keep(fromPage(await body(res), url), "sitemap");
    }
  }

  const total = report.feed + report.sitemap;
  if (total < MIN_ARTICLES) throw new Error(`${account.handle}: only ${total} articles, need at least ${MIN_ARTICLES}`);
  return report;
}
