import { useState, FormEvent } from 'react';
import { Form } from '@/data/mockData';

interface UseFormSubmitOptions {
    siteId?: string;
    form: Form;
    onSuccess: () => void;
}

export function useFormSubmit({ siteId, form, onSuccess }: UseFormSubmitOptions) {
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const setField = (fieldId: string, value: string) => {
        setFormData(prev => ({ ...prev, [fieldId]: value }));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch('/api/forms/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    formId: form.id,
                    formTitle: form.title,
                    data: formData,
                    siteId,
                    fieldLabels: form.fields?.reduce(
                        (acc, f) => ({ ...acc, [f.id]: f.label }),
                        {} as Record<string, string>
                    ),
                }),
            });
            if (!res.ok) throw new Error('Submission failed');
            onSuccess();
        } catch {
            setError('Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return { formData, setField, submitting, error, handleSubmit };
}
