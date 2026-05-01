'use client';

import { FormField } from '@/data/mockData';
import { FormFileField } from '@/components/FormFileField';

interface FormFieldsRendererProps {
    fields: FormField[];
    formData: Record<string, string>;
    onChange: (fieldId: string, value: string) => void;
    labelClassName: string;
    inputClassName: string;
}

export function FormFieldsRenderer({
    fields,
    formData,
    onChange,
    labelClassName,
    inputClassName,
}: FormFieldsRendererProps) {
    return (
        <>
            {fields.map((field) => (
                <div key={field.id}>
                    {field.type !== 'file' && (
                        <label className={`block text-sm font-bold mb-1 ${labelClassName}`}>
                            {field.label}{' '}
                            {field.required && <span className="text-red-500">*</span>}
                        </label>
                    )}

                    {field.type === 'textarea' ? (
                        <textarea
                            required={field.required}
                            placeholder={field.placeholder}
                            value={formData[field.id] || ''}
                            onChange={(e) => onChange(field.id, e.target.value)}
                            className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors font-medium resize-none h-32 ${inputClassName}`}
                        />
                    ) : field.type === 'select' ? (
                        <select
                            required={field.required}
                            value={formData[field.id] || ''}
                            onChange={(e) => onChange(field.id, e.target.value)}
                            className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors font-medium appearance-none ${inputClassName}`}
                        >
                            <option value="">Select an option...</option>
                            {field.options?.map((opt) => (
                                <option key={opt} value={opt}>
                                    {opt}
                                </option>
                            ))}
                        </select>
                    ) : field.type === 'file' ? (
                        <FormFileField
                            label={field.label}
                            required={field.required}
                            value={formData[field.id] || ''}
                            onChange={(url) => onChange(field.id, url)}
                        />
                    ) : (
                        <input
                            type={field.type}
                            required={field.required}
                            placeholder={field.placeholder}
                            value={formData[field.id] || ''}
                            onChange={(e) => onChange(field.id, e.target.value)}
                            className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors font-medium ${inputClassName}`}
                        />
                    )}
                </div>
            ))}
        </>
    );
}
