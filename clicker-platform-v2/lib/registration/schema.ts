import { z } from 'zod';

const PHONE_RE = /^(\+62|62|0)[0-9]{8,13}$/;

export const businessTypeSchema = z.enum([
  'fnb',
  'auto-detailing',
  'beauty-spa',
  'retail',
  'service',
  'other',
]);

export const registrationInputSchema = z
  .object({
    name: z.string().min(1).max(120),
    email: z.string().email().max(200),
    phone: z.string().regex(PHONE_RE, 'Invalid Indonesian phone number'),

    businessName: z.string().min(2).max(120),
    businessType: businessTypeSchema,
    city: z.string().min(1).max(80),
    expectedOutlets: z.number().int().min(1).max(10000),

    bundle: z.string().nullable(),
    modules: z.array(z.string()).max(50),
    customRequest: z.string().max(2000),
    promoCode: z.string().max(80).nullable(),
    promoCodeValidAtSubmit: z.boolean(),

    source: z.string().max(500).nullable(),
  })
  .refine(
    (v) => v.modules.length > 0 || v.customRequest.trim().length > 0,
    { message: 'Pick at least one module or describe your custom request', path: ['modules'] }
  );

export type RegistrationInput = z.infer<typeof registrationInputSchema>;
