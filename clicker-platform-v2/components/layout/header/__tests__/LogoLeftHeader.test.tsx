import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LogoLeftHeader } from '../variants/LogoLeftHeader';
import type { NavigationItem, HeaderCTA, BusinessProfile } from '@/data/mockData';

// Mock TemplateProvider + site context to avoid full-tree boot
vi.mock('@/components/TemplateProvider', () => ({
  useTemplate: () => ({
    theme: {
      colors: {
        foreground: '#000',
        background: '#fff',
        primary: '#111',
        primaryForeground: '#fff',
        accentForeground: '#fff',
        border: '#eee',
        surface: '#fafafa',
      },
    },
    templateId: 'test',
  }),
}));
vi.mock('@/lib/site-context', () => ({
  useSite: () => ({ tenantSlug: 'test', isSubdomain: false }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: () => {} }),
}));

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src }: any) => null,
}));

const profile: BusinessProfile = { name: 'Test Site', avatarUrl: '', tagline: '', description: '', templateConfig: {} } as any;

const items: NavigationItem[] = [
  { id: '1', label: 'Home', type: 'link', value: '/' },
  { id: '2', label: 'Shop', type: 'link', value: '/shop' },
];
const cta: HeaderCTA = { enabled: true, label: 'Book', linkType: 'url', linkValue: '#' };

describe('LogoLeftHeader', () => {
  it('renders logo, menu items, and CTA in left-to-right DOM order', () => {
    render(
      <LogoLeftHeader
        profile={profile}
        items={items}
        cta={cta}
        typographyClass="text-sm"
        onItemClick={() => {}}
        forceMobile={false}
      />
    );

    const home = screen.getByText('Home');
    const shop = screen.getByText('Shop');
    const book = screen.getByText('Book');
    expect(home).toBeInTheDocument();
    expect(shop).toBeInTheDocument();
    expect(book).toBeInTheDocument();

    // DOM order: site name (logo group) → Home → Shop → Book
    const all = [screen.getByText('Test Site'), home, shop, book];
    for (let i = 0; i < all.length - 1; i++) {
      expect(all[i].compareDocumentPosition(all[i + 1])).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }
  });

  it('hides desktop menu when forceMobile is true', () => {
    const { container } = render(
      <LogoLeftHeader
        profile={profile}
        items={items}
        cta={cta}
        typographyClass="text-sm"
        onItemClick={() => {}}
        forceMobile={true}
      />
    );
    // Desktop menu container has 'hidden' class when forceMobile
    const desktopMenu = container.querySelector('[data-testid="desktop-menu"]');
    expect(desktopMenu?.className).toContain('hidden');
  });
});
