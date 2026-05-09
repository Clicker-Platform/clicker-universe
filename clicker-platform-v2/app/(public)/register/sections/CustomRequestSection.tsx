'use client';

interface Props {
  customRequest: string;
  errors: Record<string, string[] | undefined>;
  onChange: (value: string) => void;
}

export function CustomRequestSection({ customRequest, errors, onChange }: Props) {
  return (
    <fieldset>
      <legend className="text-lg font-semibold text-neutral-900 mb-2">
        Custom request (opsional)
      </legend>
      <p className="text-sm text-neutral-600 mb-2">
        Punya kebutuhan khusus yang belum tercakup oleh modul di atas? Jelaskan di sini.
      </p>
      <textarea
        value={customRequest}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        maxLength={2000}
        className="block w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
      />
      {errors.customRequest && (
        <p className="mt-1 text-sm text-red-600">{errors.customRequest[0]}</p>
      )}
    </fieldset>
  );
}
