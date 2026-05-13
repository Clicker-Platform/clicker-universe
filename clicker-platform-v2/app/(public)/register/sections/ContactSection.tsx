'use client';

interface Props {
  name: string;
  email: string;
  phone: string;
  errors: Record<string, string[] | undefined>;
  onChange: (field: 'name' | 'email' | 'phone', value: string) => void;
}

export function ContactSection({ name, email, phone, errors, onChange }: Props) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-lg font-semibold text-neutral-900 mb-2">Kontak</legend>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-neutral-700">
          Nama lengkap
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => onChange('name', e.target.value)}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          required
          maxLength={120}
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name[0]}</p>}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => onChange('email', e.target.value)}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          required
          maxLength={200}
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email[0]}</p>}
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-neutral-700">
          No. WhatsApp
        </label>
        <div className="mt-1 flex">
          <span className="inline-flex items-center rounded-l-md border border-r-0 border-neutral-300 bg-neutral-100 px-3 text-sm font-medium text-neutral-600">
            +62
          </span>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            value={phone.replace(/^\+62/, '')}
            onChange={(e) => {
              let v = e.target.value.replace(/[^0-9]/g, '');
              if (v.startsWith('0')) v = v.slice(1);
              onChange('phone', v ? `+62${v}` : '');
            }}
            placeholder="81234567890"
            className="block w-full rounded-r-md border border-neutral-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            required
          />
        </div>
        {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone[0]}</p>}
      </div>
    </fieldset>
  );
}
