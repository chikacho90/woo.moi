import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import { makeSiteToken, COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Todo {
  id: string;
  title: string;
  status: "open" | "done" | "cancelled";
  priority?: "low" | "medium" | "high";
  dueDate?: string;
  category?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface TodosFile {
  todos: Todo[];
  updatedAt: string | null;
}

const REPO = "chikacho90/aibot-memory";
const FILE_PATH = "todos.json";

function ghHeaders(write = false): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "woo-moi",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  if (write) h["Content-Type"] = "application/json";
  return h;
}

async function authCheck(): Promise<NextResponse | null> {
  const secret = process.env.SITE_SECRET;
  if (!secret) return null;
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const expected = await makeSiteToken(secret);
  if (token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

async function getFile(): Promise<{ content: TodosFile; sha: string } | null> {
  const url = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;
  const res = await fetch(url, { headers: ghHeaders(), cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { content: string; sha: string };
  const raw = Buffer.from(json.content, "base64").toString("utf-8");
  return { content: JSON.parse(raw) as TodosFile, sha: json.sha };
}

async function putFile(content: TodosFile, sha: string, message: string): Promise<boolean> {
  const url = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;
  const body = JSON.stringify({
    message,
    content: Buffer.from(JSON.stringify(content, null, 2) + "\n").toString("base64"),
    sha,
    committer: { name: "woo.moi/todo", email: "chikacho90+web@users.noreply.github.com" },
  });
  const res = await fetch(url, { method: "PUT", headers: ghHeaders(true), body });
  return res.ok;
}

function genId(): string {
  return `t_${Math.floor(Date.now() / 1000)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET() {
  const blocked = await authCheck();
  if (blocked) return blocked;

  const file = await getFile();
  if (!file) return NextResponse.json({ error: "repo unreachable" }, { status: 502 });
  return NextResponse.json({ ...file.content, fetchedAt: new Date().toISOString() });
}

export async function POST(req: NextRequest) {
  const blocked = await authCheck();
  if (blocked) return blocked;

  const body = (await req.json()) as Partial<Todo>;
  if (!body.title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const file = await getFile();
  if (!file) return NextResponse.json({ error: "repo unreachable" }, { status: 502 });

  const now = new Date().toISOString();
  const todo: Todo = {
    id: genId(),
    title: body.title,
    status: "open",
    priority: body.priority ?? "medium",
    dueDate: body.dueDate,
    category: body.category,
    notes: body.notes,
    createdAt: now,
    updatedAt: now,
  };
  file.content.todos.push(todo);
  file.content.updatedAt = now;

  const ok = await putFile(file.content, file.sha, `todo: add "${todo.title}"`);
  if (!ok) return NextResponse.json({ error: "write failed" }, { status: 502 });
  return NextResponse.json({ todo });
}

export async function PATCH(req: NextRequest) {
  const blocked = await authCheck();
  if (blocked) return blocked;

  const body = (await req.json()) as { id: string; patch: Partial<Todo> };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const file = await getFile();
  if (!file) return NextResponse.json({ error: "repo unreachable" }, { status: 502 });

  const now = new Date().toISOString();
  let found = false;
  file.content.todos = file.content.todos.map((t) => {
    if (t.id !== body.id) return t;
    found = true;
    const merged = { ...t, ...body.patch, updatedAt: now };
    if (body.patch.status === "done" && !merged.completedAt) merged.completedAt = now;
    if (body.patch.status === "open") delete merged.completedAt;
    return merged;
  });
  if (!found) return NextResponse.json({ error: "not found" }, { status: 404 });
  file.content.updatedAt = now;

  const ok = await putFile(file.content, file.sha, `todo: patch ${body.id}`);
  if (!ok) return NextResponse.json({ error: "write failed" }, { status: 502 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const blocked = await authCheck();
  if (blocked) return blocked;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const file = await getFile();
  if (!file) return NextResponse.json({ error: "repo unreachable" }, { status: 502 });

  const before = file.content.todos.length;
  file.content.todos = file.content.todos.filter((t) => t.id !== id);
  if (file.content.todos.length === before) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  file.content.updatedAt = new Date().toISOString();

  const ok = await putFile(file.content, file.sha, `todo: rm ${id}`);
  if (!ok) return NextResponse.json({ error: "write failed" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
