import Link from 'next/link';
import { ArrowRight, LayoutDashboard, Sparkles, Globe, ShoppingBag, CalendarCheck, Users, Package, Bot, Layers, Check, Zap } from 'lucide-react';

export default function LandingPage() {
  const modules = [
    { icon: Globe, name: 'Biolink', desc: 'Landing page cantik untuk bisnismu', price: 'Harga: Coming Soon' },
    { icon: ShoppingBag, name: 'BYOD POS', desc: 'Kasir & manajemen pesanan', price: 'Harga: Coming Soon' },
    { icon: CalendarCheck, name: 'Reservasi', desc: 'Booking meja & appointment', price: 'Harga: Coming Soon' },
    { icon: Package, name: 'Inventory', desc: 'Pantau stok barang', price: 'Harga: Coming Soon' },
    { icon: Users, name: 'Membership', desc: 'Program loyalty pelanggan', price: 'Harga: Coming Soon' },
    { icon: Bot, name: 'AI Sales Agent', desc: 'Asisten AI 24/7', price: 'Harga: Coming Soon' },
  ];

  const benefits = [
    'Semua modul tanpa batasan',
    'Update fitur selamanya',
    'Tanpa biaya bulanan',
    'Support prioritas',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-lime-300 via-lime-400 to-lime-500">
      {/* Navigation */}
      <nav className="flex items-center justify-between p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-brand-dark rounded-xl flex items-center justify-center">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-black text-brand-dark">Clicker</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="px-6 py-2.5 bg-white text-brand-dark font-bold rounded-xl border-[3px] border-brand-dark hover:bg-brand-dark hover:text-white transition-all"
          >
            Login
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-16 md:py-20">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 rounded-full border-2 border-brand-dark/20">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-bold text-brand-dark">Bayar Sekali, Pakai Selamanya! 🎉</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-brand-dark leading-tight">
            Bikin WebApp Bisnis<br />
            <span className="text-white drop-shadow-lg">Dalam Hitungan Menit</span>
          </h1>

          <p className="text-xl text-brand-dark/80 max-w-2xl mx-auto leading-relaxed">
            Platform modular untuk UMKM. Pilih modul sesuai kebutuhan — <strong>Biolink</strong>, <strong>POS</strong>, <strong>Reservasi</strong>, <strong>Inventory</strong>, <strong>Membership</strong>, hingga <strong>AI Sales Agent</strong>.
            <br className="hidden md:block" />
            <span className="font-bold">Tanpa subscription, tanpa ribet.</span>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <Link
              href="/admin"
              className="flex items-center gap-2 px-8 py-4 bg-brand-dark text-white font-bold rounded-2xl hover:bg-brand-dark/90 transition-all group shadow-xl"
            >
              <LayoutDashboard className="w-5 h-5" />
              Daftar Sekarang
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/demo"
              className="flex items-center gap-2 px-8 py-4 bg-white text-brand-dark font-bold rounded-2xl border-[3px] border-brand-dark hover:bg-brand-dark hover:text-white transition-all"
            >
              <Globe className="w-5 h-5" />
              Lihat Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Modules Grid */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-black text-brand-dark mb-2">6 Modul, 1 Platform</h2>
          <p className="text-brand-dark/70">Aktifkan yang kamu butuhkan, nonaktifkan yang nggak perlu</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border-[3px] border-brand-dark p-6 hover:shadow-xl hover:-translate-y-1 transition-all group"
            >
              <div className="w-12 h-12 bg-lime-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-lime-200 transition-colors">
                <module.icon className="w-6 h-6 text-brand-dark" />
              </div>
              <h3 className="text-xl font-bold text-brand-dark mb-1">{module.name}</h3>
              <p className="text-brand-dark/60 text-sm mb-3">{module.desc}</p>
              <div className="pt-3 border-t border-gray-100">
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                  {module.price}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing CTA Section */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="bg-white rounded-3xl border-[3px] border-brand-dark p-8 md:p-12 relative overflow-hidden">
          {/* Badge */}
          <div className="absolute -top-1 -right-1 bg-amber-400 text-brand-dark font-black px-6 py-2 rounded-bl-2xl border-l-[3px] border-b-[3px] border-brand-dark text-sm">
            LIFETIME DEAL 🔥
          </div>

          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-black text-brand-dark mb-4">
              Bayar Sekali, Pakai Selamanya
            </h2>
            <p className="text-brand-dark/60 mb-8 max-w-xl mx-auto">
              Nggak ada subscription bulanan. Nggak ada hidden fees. Sekali bayar, semua modul jadi milikmu selamanya.
            </p>

            {/* Benefits */}
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              {benefits.map((benefit, i) => (
                <div key={i} className="flex items-center gap-2 bg-lime-50 px-4 py-2 rounded-full">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-brand-dark">{benefit}</span>
                </div>
              ))}
            </div>

            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-10 py-5 bg-brand-dark text-white font-bold text-lg rounded-2xl hover:bg-brand-dark/90 transition-all shadow-xl"
            >
              <Sparkles className="w-5 h-5" />
              Mulai Sekarang
              <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="text-sm text-brand-dark/50 mt-4">Satu kali bayar, akses selamanya.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-brand-dark/20 mt-8">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center">
          <p className="text-brand-dark/60 font-medium">© 2024 Clicker Platform. Made with ❤️ in Indonesia</p>
        </div>
      </footer>
    </div>
  );
}
