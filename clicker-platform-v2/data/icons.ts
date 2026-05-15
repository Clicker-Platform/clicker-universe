import type React from 'react';
import {
    // Socials
    Instagram, Facebook, Twitter, Linkedin, Youtube, Github,
    Twitch, Globe, Mail, Phone, MessageCircle, Send,

    // Commerce
    ShoppingBag, ShoppingCart, CreditCard, DollarSign, Tag,
    Gift, Package, Store, Coffee, Utensils,

    // UI / Actions
    Link, ExternalLink, Map, MapPin, Navigation,
    Calendar, Clock, Star, Heart, ThumbsUp,
    Award, User, Users, Briefcase, FileText,

    // Media / Content
    Image, Video, Music, Play, Camera, Mic,

    // Tech / Misc
    Smartphone, Laptop, Wifi, Cloud, Zap,
    Book, Bookmark, Search, Home, Info,

    // Transport
    Car, Bus, Bike, Plane,

    // Decorations
    Croissant, Sparkles
} from 'lucide-react';

export const ICON_MAP: { [key: string]: React.ElementType } = {
    // Socials
    Instagram, Facebook, Twitter, Linkedin, Youtube, Github,
    Twitch, Globe, Mail, Phone, MessageCircle, Send,

    // Commerce
    ShoppingBag, ShoppingCart, CreditCard, DollarSign, Tag,
    Gift, Package, Store, Coffee, Utensils,

    // UI / Actions
    LinkIcon: Link, // Alias for default
    Link, ExternalLink, Map, MapPin, Navigation,
    Calendar, Clock, Star, Heart, ThumbsUp,
    Award, User, Users, Briefcase, FileText,

    // Media / Content
    Image, Video, Music, Play, Camera, Mic,

    // Tech / Misc
    Smartphone, Laptop, Wifi, Cloud, Zap,
    Book, Bookmark, Search, Home, Info,

    // Transport
    Car, Bus, Bike, Plane,

    // Decorations
    Croissant, Sparkles
};

export const ICON_NAMES = Object.keys(ICON_MAP).sort();
