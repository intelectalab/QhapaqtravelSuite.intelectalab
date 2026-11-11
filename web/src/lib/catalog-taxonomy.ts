export interface TaxonomyProduct {
  code: string;
  name: string;
  status: string;
}

export interface ProductType {
  id: string;
  name: string;
  requires_itinerary: boolean;
  requires_components: boolean;
  sort_order: number;
  version: string;
  products: TaxonomyProduct[];
}

export interface ProductSubcategory {
  id: string;
  name: string;
  version: string;
  products: TaxonomyProduct[];
}

export interface ProductCategory {
  id: string;
  ref: string;
  name: string;
  version: string;
  products: TaxonomyProduct[];
  subcategories: ProductSubcategory[];
}

export interface TaxonomyOverview {
  types: ProductType[];
  categories: ProductCategory[];
  can: { manage: boolean };
}
