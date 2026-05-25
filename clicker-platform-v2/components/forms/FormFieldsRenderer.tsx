'use client';

import type { CSSProperties } from 'react';
import { FormField } from '@/data/mockData';
import { FormFileField } from '@/components/FormFileField';

interface FormFieldsRendererProps {
    fields: FormField[];
    formData: Record<string, string>;
    onChange: (fieldId: string, value: string) => void;
    labelClassName: string;
    inputClassName: string;
    labelStyle?: CSSProperties;
    inputStyle?: CSSProperties;
}

export function FormFieldsRenderer({
    fields,
    formData,
    onChange,
    labelClassName,
    inputClassName,
    labelStyle,
    inputStyle,
}: FormFieldsRendererProps) {
    return (
        <>
            {fields.map((field) => (
                <div key={field.id}>
                    {field.type !== 'file' && (
                        <label className={`block ${labelClassName}`} style={labelStyle}>
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
                            className={`${inputClassName} resize-none h-32`}
                            style={inputStyle}
                        />
                    ) : field.type === 'select' ? (
                        <select
                            required={field.required}
                            value={formData[field.id] || ''}
                            onChange={(e) => onChange(field.id, e.target.value)}
                            className={`${inputClassName} appearance-none`}
                            style={inputStyle}
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
                            className={inputClassName}
                            style={inputStyle}
                        />
                    )}
                </div>
            ))}
        </>
    );
}
