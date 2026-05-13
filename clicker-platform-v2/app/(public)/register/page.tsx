import RegisterForm from './RegisterForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Daftar — Clicker Universe',
  description: 'Daftarkan bisnis Anda untuk mulai menggunakan Clicker.',
};

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-neutral-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold text-neutral-900">Daftar Clicker</h1>
          <p className="mt-2 text-neutral-600">
            Isi form di bawah untuk mengajukan akses. Tim kami akan meninjau dan
            mengaktifkan akun Anda.
          </p>
        </header>
        <RegisterForm />
      </div>
    </main>
  );
}
