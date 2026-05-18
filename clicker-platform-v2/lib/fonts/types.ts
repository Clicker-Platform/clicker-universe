export type FontSlot = {
  family: string;
  cssVar: string;
  weights: number[];
};

export type FontPack = {
  id: string;
  name: string;
  description?: string;
  category: 'serif' | 'sans' | 'display' | 'mixed';
  heading: FontSlot;
  body: FontSlot;
};
