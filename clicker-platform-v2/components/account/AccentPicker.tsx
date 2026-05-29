'use client';

import { ACCENT_PRESETS, type AccentPresetId } from '@/lib/account/accent';

interface Props {
  value: AccentPresetId;
  onChange: (p: AccentPresetId) => void;
  onClose: () => void;
}

export function AccentPicker({ value, onChange, onClose }: Props) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute right-0 top-11 z-40 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.14)] p-3.5 w-[180px]">
        <div className="font-bold text-gray-900 mb-2.5">Warna tema</div>
        <div className="flex gap-2.5">
          {(Object.keys(ACCENT_PRESETS) as AccentPresetId[]).map((id) => (
            <button
              key={id}
              onClick={() => onChange(id)}
              aria-label={id}
              className="w-[30px] h-[30px] rounded-full box-border"
              style={{
                background: ACCENT_PRESETS[id].accent,
                border: value === id ? '3px solid #111' : '3px solid transparent',
              }}
            />
          ))}
        </div>
        <div className="text-gray-400 mt-2.5 text-[10px]">Pilihan kamu, tersimpan otomatis.</div>
      </div>
    </>
  );
}
