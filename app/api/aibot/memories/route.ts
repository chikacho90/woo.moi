import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { makeSiteToken, COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 300;

interface ManifestBot {
  id: string;
  name: string;
  platform: "discord" | "telegram";
  host: string;
  hostTailscaleIp: string;
  sessionUuid: string;
}

interface Manifest {
  version: number;
  bots: ManifestBot[];
}

interface MemoryFile {
  fileName: string;
  name: string;
  description: string;
  type: string;
  content: string;
}

interface Bot extends ManifestBot {
  memoryIndex: string | null;
  memories: MemoryFile[];
  lastUpdated: string | null;
}

const REPO = "chikacho90/aibot-memory";

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "woo-moi",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function ghFetch<T>(path: string, raw = false): Promise<T | null> {
  const url = `https://api.github.com/repos/${REPO}${path}`;
  const headers = ghHeaders();
  if (raw) headers.Accept = "application/vnd.github.raw";
  try {
    const res = await fetch(url, { headers, next: { revalidate: 60 } });
    if (!res.ok) return null;
    if (raw) return (await res.text()) as unknown as T;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function parseMarkdown(raw: string): { frontmatter: Record<string, string>; content: string } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { frontmatter: {}, content: raw };
  const fm: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return { frontmatter: fm, content: m[2].trim() };
}

interface TreeNode {
  path: string;
  type: "blob" | "tree";
  sha: string;
}

interface TreeResponse {
  tree: TreeNode[];
  truncated: boolean;
}

interface CommitResponse {
  sha: string;
  commit: { author: { date: string } };
}

async function loadBotMemories(botId: string, tree: TreeNode[]): Promise<{ memoryIndex: string | null; memories: MemoryFile[] }> {
  const prefix = `bots/${botId}/memory/`;
  const files = tree.filter((n) => n.type === "blob" && n.path.startsWith(prefix) && n.path.endsWith(".md"));

  const fileContents = await Promise.all(
    files.map(async (f) => {
      const content = await ghFetch<string>(`/contents/${f.path}`, true);
      return { path: f.path, content: content ?? "" };
    })
  );

  let memoryIndex: string | null = null;
  const memories: MemoryFile[] = [];

  for (const f of fileContents) {
    const fileName = f.path.substring(prefix.length);
    if (fileName === "MEMORY.md") {
      memoryIndex = f.content;
      continue;
    }
    const { frontmatter, content } = parseMarkdown(f.content);
    memories.push({
      fileName,
      name: frontmatter.name ?? fileName.replace(/\.md$/, ""),
      description: frontmatter.description ?? "",
      type: frontmatter.type ?? "unknown",
      content,
    });
  }

  memories.sort((a, b) => a.fileName.localeCompare(b.fileName));
  return { memoryIndex, memories };
}

async function loadLastUpdated(botId: string): Promise<string | null> {
  const commits = await ghFetch<CommitResponse[]>(`/commits?path=bots/${botId}/memory&per_page=1`);
  return commits?.[0]?.commit?.author?.date ?? null;
}

export async function GET() {
  const secret = process.env.SITE_SECRET;
  if (secret) {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    const expected = await makeSiteToken(secret);
    if (token !== expected) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const manifest = await ghFetch<Manifest>(`/contents/manifest.json`, true).then((raw) => {
    if (!raw) return null;
    try {
      return JSON.parse(raw as unknown as string) as Manifest;
    } catch {
      return null;
    }
  });

  if (!manifest) {
    return NextResponse.json({ error: "manifest.json not found or GITHUB_TOKEN missing" }, { status: 502 });
  }

  const treeResp = await ghFetch<TreeResponse>(`/git/trees/main?recursive=1`);
  const tree = treeResp?.tree ?? [];

  const bots: Bot[] = await Promise.all(
    manifest.bots.map(async (mb) => {
      const [{ memoryIndex, memories }, lastUpdated] = await Promise.all([
        loadBotMemories(mb.id, tree),
        loadLastUpdated(mb.id),
      ]);
      return { ...mb, memoryIndex, memories, lastUpdated };
    })
  );

  return NextResponse.json({
    bots,
    fetchedAt: new Date().toISOString(),
    repo: REPO,
  });
}
