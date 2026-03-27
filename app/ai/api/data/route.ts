import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, makeLabsToken } from "@/lib/auth";

const REPO = "lookgitme/woo.moi";
const BRANCH = "main";
const TOKEN = process.env.GITHUB_TOKEN!;
const API = "https://api.github.com";
const H = { Authorization: `token ${TOKEN}`, "User-Agent": "woo-moi", Accept: "application/vnd.github.v3+json" };

const BOTS = ["woovis", "9oovis", "pulmang"];

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

// GET: read all bot data or single bot
export async function GET(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const bot = req.nextUrl.searchParams.get("bot");

  if (bot) {
    // Single bot
    const file = await readFile(`data/${bot}.json`);
    if (!file) return NextResponse.json({ data: null, sha: null });
    return NextResponse.json({ data: JSON.parse(file.content), sha: file.sha });
  }

  // All bots
  const results: Record<string, { data: unknown; sha: string | null }> = {};
  await Promise.all(
    BOTS.map(async (id) => {
      const file = await readFile(`data/${id}.json`);
      if (file) {
        results[id] = { data: JSON.parse(file.content), sha: file.sha };
      } else {
        results[id] = { data: null, sha: null };
      }
    })
  );
  return NextResponse.json(results);
}

// PUT: update a bot's data
export async function PUT(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { bot, data, sha } = await req.json();
  if (!bot || !data) return NextResponse.json({ error: "missing bot or data" }, { status: 400 });
  const result = await writeFile(`data/${bot}.json`, JSON.stringify(data, null, 2), sha);
  return NextResponse.json(result);
}
