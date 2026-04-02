import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are a travel planning assistant. Given trip context, generate activity cards for a travel schedule.

Return a JSON array of card objects. Each card:
{
  "emoji": "single emoji",
  "name": "short name (Korean)",
  "description": "1-line description (Korean)",
  "category": "transport" | "accommodation" | "activity" | "food" | "chill" | "errand",
  "tags": [],
  "compatibleSlots": subset of ["오전", "점심", "오후", "저녁", "밤"],
  "compatibleAreas": ["any"],
  "estimatedMinutes": number
}

Rules:
- Generate 10-15 cards covering transport, activities, food, accommodation, chill
- Each card is atomic: one activity per card
- Match the destination's real places, restaurants, activities
- Consider companion type, budget, travel styles
- Use Korean for names and descriptions
- Be specific: real place names, cuisine types, activity names
- Only return the JSON array, no markdown`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const body = await req.json();
  const { destination, days, companion, budget, styles } = body;

  const parts: string[] = ["여행 계획 카드를 만들어줘.\n"];
  if (destination) parts.push(`목적지: ${destination}`);
  else parts.push("목적지: 미정 (일반적인 해외여행 기준)");
  parts.push(`여행 일수: ${days || 3}일`);
  if (companion) parts.push(`동반자: ${companion}`);
  if (budget) parts.push(`예산: ${budget}만원`);
  if (styles?.length) parts.push(`여행 스타일: ${styles.join(", ")}`);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: parts.join("\n") }],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `API error: ${response.status}` }, { status: 502 });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    const cards = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ cards });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
