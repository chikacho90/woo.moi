'use client';

import dynamic from 'next/dynamic';

const ShaderCanvas = dynamic(() => import('./ShaderCanvas'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-[#06060f]" />,
});

export default function Scene() {
  return <ShaderCanvas />;
}
