export type TxnType = "income" | "expense" | "transfer";

export interface Transaction {
  id: number;
  date: string; // YYYY-MM-DD
  type: TxnType;
  amount: number; // KRW integer
  category: string;
  subcategory?: string | null;
  account?: string | null;
  memo?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonthSummary {
  income: number;
  expense: number;
  net: number;
  count: number;
}

export interface CategoryBreakdown {
  category: string;
  total: number;
  count: number;
}

// 한국 소비/수입 카테고리 기본값. UI에서 suggest로 사용.
export const DEFAULT_CATEGORIES = {
  income: ["월급", "프리랜스", "보너스", "이자·배당", "환급", "기타수입"],
  expense: [
    "식비", "카페", "교통", "주거", "통신", "공과금", "보험",
    "대출상환", "차량유지", "쇼핑", "여가", "의료", "경조사", "기타",
  ],
  transfer: ["계좌이동", "저축", "투자"],
} as const;

export const DEFAULT_ACCOUNTS = ["토스", "우리", "하나", "신한", "국민", "현금", "카드"] as const;
