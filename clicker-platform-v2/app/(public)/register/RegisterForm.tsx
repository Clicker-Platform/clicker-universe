'use client';

import { useState, useTransition } from 'react';
import { submitRegistration } from '@/lib/registration/submit-action';
import {
  registrationInputSchema,
  type RegistrationInput,
} from '@/lib/registration/schema';
import { ContactSection } from './sections/ContactSection';
import { BusinessSection } from './sections/BusinessSection';
import { ModulesSection } from './sections/ModulesSection';
import { CustomRequestSection } from './sections/CustomRequestSection';
import { PromoCodeSection } from './sections/PromoCodeSection';

type FieldErrors = Record<string, string[] | undefined>;

const INITIAL: RegistrationInput = {
  name: '',
  email: '',
  phone: '',
  businessName: '',
  businessType: 'fnb',
  city: '',
  expectedOutlets: 1,
  bundle: null,
  modules: [],
  customRequest: '',
  promoCode: null,
  promoCodeValidAtSubmit: false,
  source: null,
};

export default function RegisterForm() {
  const [form, setForm] = useState<RegistrationInput>(INITIAL);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoValid, setPromoValid] = useState<boolean | null>(null);
  const [promoName, setPromoName] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update<K extends keyof RegistrationInput>(field: K, value: RegistrationInput[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function focusFirstError(fe: FieldErrors) {
    if (typeof window === 'undefined') return;
    const firstKey = Object.keys(fe)[0];
    if (!firstKey) return;
    const el = document.getElementById(firstKey);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof (el as HTMLInputElement).focus === 'function') {
        (el as HTMLInputElement).focus({ preventScroll: true });
      }
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setGlobalError(null);

    const finalCode = promoCodeInput.trim() || null;
    const payload: RegistrationInput = {
      ...form,
      promoCode: finalCode,
      promoCodeValidAtSubmit: finalCode ? promoValid === true : false,
      source: typeof window !== 'undefined' ? window.location.href.slice(0, 500) : null,
    };

    const parsed = registrationInputSchema.safeParse(payload);
    if (!parsed.success) {
      const fe: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || '_';
        (fe[key] ??= []).push(issue.message);
      }
      setErrors(fe);
      setGlobalError('Ada beberapa isian yang perlu diperbaiki. Periksa form di atas.');
      focusFirstError(fe);
      return;
    }

    startTransition(async () => {
      const r = await submitRegistration(parsed.data);
      if (r.ok) {
        setSubmittedId(r.id);
      } else {
        setGlobalError(r.error);
        if (r.fieldErrors) {
          setErrors(r.fieldErrors);
          focusFirstError(r.fieldErrors);
        }
      }
    });
  }

  if (submittedId) {
    return (
      <div className="rounded-md border border-green-300 bg-green-50 p-6">
        <h2 className="text-xl font-semibold text-green-900">Pendaftaran terkirim ✓</h2>
        <p className="mt-2 text-green-800">
          Terima kasih! Tim kami akan meninjau permintaan Anda dan menghubungi via email
          atau WhatsApp dalam 1×24 jam.
        </p>
        <p className="mt-2 text-xs text-green-700">ID referensi: {submittedId}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-sm">
      <ContactSection
        name={form.name}
        email={form.email}
        phone={form.phone}
        errors={errors}
        onChange={(field, value) => update(field, value)}
      />

      <BusinessSection
        businessName={form.businessName}
        businessType={form.businessType}
        city={form.city}
        expectedOutlets={form.expectedOutlets}
        errors={errors}
        onChange={(field, value) => {
          if (field === 'expectedOutlets')
            update(field, (value as number | null) ?? (NaN as unknown as number));
          else if (field === 'businessType')
            update(field, value as RegistrationInput['businessType']);
          else update(field, value as string);
        }}
      />

      <ModulesSection
        bundle={form.bundle}
        modules={form.modules}
        errors={errors}
        onBundleChange={(b) => update('bundle', b)}
        onModulesChange={(m) => update('modules', m)}
      />

      <CustomRequestSection
        customRequest={form.customRequest}
        errors={errors}
        onChange={(v) => update('customRequest', v)}
      />

      <PromoCodeSection
        promoCode={promoCodeInput}
        promoValid={promoValid}
        promoName={promoName}
        onChange={setPromoCodeInput}
        onValidated={(valid, name) => {
          setPromoValid(valid);
          setPromoName(name);
        }}
      />

      {globalError && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {globalError}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? 'Mengirim...' : 'Kirim pendaftaran'}
      </button>
    </form>
  );
}
