"use client";

type Props = {
  lat: number;
  lng: number;
  name?: string;
  onClose: () => void;
};

export default function MapLinkModal({ lat, lng, name, onClose }: Props) {
  const q = name ? encodeURIComponent(name) : `${lat},${lng}`;
  const links: { key: string; label: string; emoji: string; href: string }[] = [
    {
      key: "google",
      label: "구글 지도",
      emoji: "🗺️",
      href: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    },
    {
      key: "apple",
      label: "Apple 지도",
      emoji: "🍎",
      href: `https://maps.apple.com/?ll=${lat},${lng}&q=${q}`,
    },
    {
      key: "naver",
      label: "네이버 지도",
      emoji: "🟢",
      href: `https://map.naver.com/p/search/${q}?c=15.00,0,0,0,dh&p=${lng},${lat},15,0,0,0,dh`,
    },
    {
      key: "kakao",
      label: "카카오맵",
      emoji: "🟡",
      href: `https://map.kakao.com/link/map/${q},${lat},${lng}`,
    },
    {
      key: "tmap",
      label: "티맵",
      emoji: "🅃",
      href: `tmap://route?goalx=${lng}&goaly=${lat}&goalname=${q}`,
    },
  ];

  return (
    <div className="fixed inset-0 z-[9500]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 rounded-t-2xl shadow-xl p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">길 안내 앱 선택</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
            aria-label="닫기"
          >
            ×
          </button>
        </div>
        <ul className="space-y-1">
          {links.map((l) => (
            <li key={l.key}>
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition"
                onClick={onClose}
              >
                <span className="text-lg w-6 text-center">{l.emoji}</span>
                <span className="text-sm">{l.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
