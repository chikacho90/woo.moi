import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, makeLabsToken } from "@/lib/auth";

const REPO = "lookgitme/shared-brain";
const BRANCH = "main";
const TOKEN = process.env.GITHUB_TOKEN!;
const API = "https://api.github.com";
const HEADERS = {
  Authorization: `token ${TOKEN}`,
  "User-Agent": "woo-moi",
  Accept: "application/vnd.github.v3+json",
};

async function checkAuth() {
  const secret = process.env.LABS_SECRET;
  if (!secret) return false;
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  return token === (await makeLabsToken(secret));
}

// GET: list files or read a file
export async function GET(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const path = req.nextUrl.searchParams.get("path");

  if (!path) {
    // List all files
    const r = await fetch(`${API}/repos/${REPO}/git/trees/${BRANCH}?recursive=1`, { headers: HEADERS });
    const data = await r.json();
    const files = (data.tree || [])
      .filter((f: { type: string }) => f.type === "blob")
      .map((f: { path: string; size: number }) => ({ path: f.path, size: f.size }));
    return NextResponse.json({ files });
  }

  // Read file
  const r = await fetch(`${API}/repos/${REPO}/contents/${encodeURIComponent(path)}?ref=${BRANCH}`, { headers: HEADERS });
  if (!r.ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  const data = await r.json();
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return NextResponse.json({ path: data.path, content, sha: data.sha });
}

// PUT: create or update a file
export async function PUT(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { path, content, sha, message } = await req.json();
  if (!path || content === undefined) return NextResponse.json({ error: "missing fields" }, { status: 400 });

  const body: Record<string, string> = {
    message: message || `update: ${path}`,
    content: Buffer.from(content).toString("base64"),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;

  const r = await fetch(`${API}/repos/${REPO}/contents/${encodeURIComponent(path)}`, {
    method: "PUT",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  return NextResponse.json({ ok: r.ok, sha: data?.content?.sha });
}

// DELETE: delete a file
export async function DELETE(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { path, sha } = await req.json();
  if (!path || !sha) return NextResponse.json({ error: "missing path or sha" }, { status: 400 });

  const r = await fetch(`${API}/repos/${REPO}/contents/${encodeURIComponent(path)}`, {
    method: "DELETE",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ message: `delete: ${path}`, sha, branch: BRANCH }),
  });
  return NextResponse.json({ ok: r.ok });
}
