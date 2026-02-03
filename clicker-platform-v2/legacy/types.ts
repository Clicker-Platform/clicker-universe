import { LucideIcon } from 'lucide-react';

export interface LinkItem {
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  icon?: LucideIcon;
  highlight?: boolean;
}

export interface SocialLink {
  platform: string;
  url: string;
  icon: LucideIcon;
}

export interface BusinessProfile {
  name: string;
  tagline: string;
  description: string;
  avatarUrl: string;
}

export interface Product {
  id: string;
  name: string;
  price: string;
  imageUrl: string;
  description?: string;
}