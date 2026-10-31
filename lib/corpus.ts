import fs from "node:fs";
import path from "node:path";
import { HANDLE } from "./accounts.ts";

export type Article = { title: string; url: string; date: string; body: string };

const dir = (handle: string) => {
  if (!HANDLE.test(handle)) throw new Error(`Not a valid handle: ${handle}`);
  return path.join(process.cwd(), "corpus", handle);
};

const slug = (url: string) =>
  new URL(url).pathname.split("/").filter(Boolean).at(-1)!.toLowerCase().replace(/[^a-z0-9-]+/g, "-");

export function writeArticle(handle: string, a: Article): void {
  fs.mkdirSync(dir(handle), { recursive: true });
  const front = `---\ntitle: ${JSON.stringify(a.title)}\nurl: ${a.url}\ndate: ${a.date}\n---\n\n`;
  fs.writeFileSync(path.join(dir(handle), `${slug(a.url)}.md`), front + a.body + "\n");
}

export function readCorpus(handle: string): Article[] {
  if (!fs.existsSync(dir(handle))) return [];
  return fs
    .readdirSync(dir(handle))
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir(handle), f), "utf8");
      const m = raw.match(/^---\ntitle: (.*)\nurl: (.*)\ndate: (.*)\n---\n\n([\s\S]*)$/);
      if (!m) throw new Error(`Bad frontmatter in corpus/${handle}/${f}`);
      return { title: JSON.parse(m[1]!), url: m[2]!, date: m[3]!, body: m[4]!.trimEnd() };
    });
}
