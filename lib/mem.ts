// woo-memory MCP(HTTP) 서버사이드 클라이언트.
// mem.woo.moi/mcp 는 JSON-RPC + SSE 응답. 서버컴포넌트/route에서만 사용(토큰 노출 금지).
import "server-only";

const ENDPOINT = process.env.MEM_URL || "https://mem.woo.moi/mcp";
const TOKEN = process.env.MEM_TOKEN || "";

type Json = Record<string, unknown>;

// SSE 본문에서 첫 JSON data 라인 추출
function parseSse(text: string): Json | null {
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t.startsWith("data:")) {
      const payload = t.slice(5).trim();
      if (payload.startsWith("{")) {
        try {
          return JSON.parse(payload);
        } catch {
          /* keep scanning */
        }
      }
    }
    if (t.startsWith("{")) {
      try {
        return JSON.parse(t);
      } catch {
        /* keep scanning */
      }
    }
  }
  return null;
}

let idc = 0;

async function rpc(method: string, params: Json): Promise<Json | null> {
  if (!TOKEN) return null;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++idc, method, params }),
      // 개인 대시보드 — 30초 캐시로 과호출 방지
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return parseSse(await res.text());
  } catch {
    return null;
  }
}

// tool 호출 → content[0].text(JSON) 파싱해서 반환
export async function callMem<T = unknown>(name: string, args: Json = {}): Promise<T | null> {
  const out = await rpc("tools/call", { name, arguments: args });
  const result = out?.result as Json | undefined;
  const content = result?.content as Array<{ type: string; text?: string }> | undefined;
  const text = content?.find((c) => c.type === "text")?.text;
  if (text == null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

// ── 타입 & 편의 함수
export type Memory = {
  id: string;
  content: string;
  type: "Decision" | "Preference" | "Context" | "Reference" | "Todo" | "Idea";
  tag: string | null;
  title: string | null;
  status: string;
  created_at?: string;
};
export type Todo = {
  id: string;
  content: string;
  status: string;
  priority?: string | null;
  due_date?: string | null;
  tag?: string | null;
  title?: string | null;
};
export type SecretMeta = { key: string; comment: string; visibility: "public" | "private" };

function asArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === "object") {
    for (const k of ["items", "secrets", "todos", "memories", "result"]) {
      const inner = (v as Json)[k];
      if (Array.isArray(inner)) return inner as T[];
    }
  }
  return [];
}

export async function getMemories(): Promise<Memory[]> {
  return asArray<Memory>(await callMem("list", {}));
}
export async function getTodos(): Promise<Todo[]> {
  return asArray<Todo>(await callMem("list_todos", {}));
}
export async function getSecrets(): Promise<SecretMeta[]> {
  return asArray<SecretMeta>(await callMem("secret_list", {}));
}
