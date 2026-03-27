import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, makeLabsToken } from "@/lib/auth";

const REPO = "lookgitme/shared-brain";
const BRANCH = "main";
const TOKEN = process.env.GITHUB_TOKEN!;
const API = "https://api.github.com";
const H = { Authorization: `token ${TOKEN}`, "User-Agent": "woo-moi", Accept: "application/vnd.github.v3+json" };

async function checkAuth() {
  const secret = process.env.LABS_SECRET;
  if (!secret) return false;
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  return token === (await makeLabsToken(secret));
}

async function readFile(path: string) {
  const r = await fetch(`${API}/repos/${REPO}/contents/${path}?ref=${BRANCH}`, { headers: H, cache: "no-store" });
  if (!r.ok) return null;
  const d = await r.json();
  return { content: Buffer.from(d.content, "base64").toString("utf-8"), sha: d.sha };
}

async function writeFile(path: string, content: string, sha?: string) {
  const body: Record<string, string> = {
    message: `update ${path}`,
    content: Buffer.from(content).toString("base64"),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;
  const r = await fetch(`${API}/repos/${REPO}/contents/${path}`, {
    method: "PUT",
    headers: { ...H, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  return { ok: r.ok, sha: d?.content?.sha };
}

// GET: read memories or skills
export async function GET(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const type = req.nextUrl.searchParams.get("type") || "memories";
  const path = `data/${type}.json`;
  const file = await readFile(path);
  if (!file) return NextResponse.json({ items: [], sha: null });
  try {
    return NextResponse.json({ items: JSON.parse(file.content), sha: file.sha });
  } catch {
    return NextResponse.json({ items: [], sha: file.sha });
  }
}

// PUT: write memories or skills
export async function PUT(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { type, items, sha } = await req.json();
  const path = `data/${type}.json`;
  const result = await writeFile(path, JSON.stringify(items, null, 2), sha);
  return NextResponse.json(result);
}
