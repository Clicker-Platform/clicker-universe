'use client';

import { SkillDefinition, SkillFormField } from '../types';

interface Props {
  skill: SkillDefinition;
  values: Record<string, any>;
  onChange: (field: string, value: any) => void;
}

function FormField({ field, value, onChange }: { field: SkillFormField; value: any; onChange: (v: any) => void }) {
  const base = 'w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 outline-none text-sm';

  if (field.type === 'textarea') {
    return (
      <textarea
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={3}
        className={`${base} resize-none`}
        required={field.required}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        className={base}
        required={field.required}
      >
        <option value="">Select...</option>
        {field.options?.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={field.placeholder}
      className={base}
      required={field.required}
    />
  );
}

export default function SkillForm({ skill, values, onChange }: Props) {
  return (
    <div className="space-y-4">
      {skill.formFields.map(field => (
        <div key={field.name}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <FormField
            field={field}
            value={values[field.name]}
            onChange={v => onChange(field.name, v)}
          />
        </div>
      ))}
    </div>
  );
}
