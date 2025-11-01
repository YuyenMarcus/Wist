export interface NormalizedProduct {
  title: string | null;
  price: number | null;
  priceRaw: string | null;
  currency: string | null;
  image: string | null;
  description: string | null;
  domain: string | null;
  url: string;
  blocked: boolean;
  rawHtmlSample?: string | null;
}

export interface ScrapeRequest {
  url: string;
  save?: boolean;
  user_id?: string;
}

export interface ScrapeResponse {
  ok: boolean;
  data?: NormalizedProduct;
  error?: string;
  detail?: string;
}
