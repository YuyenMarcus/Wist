// lib/supabase/public-profile.ts
import { createClient } from '@/utils/supabase/server'; 

export type PublicProfile = {
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export type PublicItem = {
  id: string;
  title: string;
  current_price: number | null;
  image_url: string | null;
  retailer: string | null;
  url: string;
  created_at: string;
};

export async function getPublicProfileData(username: string) {
  const supabase = await createClient();

  // 1. Get the User ID from the username
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, bio')
    .eq('username', username)
    .single();

  if (profileError || !profile) {
    console.error('Profile fetch error:', profileError);
    return { profile: null, items: [] };
  }

  // 2. Fetch ITEMS (User's list)
  const { data: userItems, error: itemsError } = await supabase
    .from('items')
    .select('id, title, current_price, image_url, retailer, url, created_at')
    .eq('user_id', profile.id)
    .eq('status', 'active') // Only show active items
    .order('created_at', { ascending: false });

  if (itemsError) {
    console.error('Items fetch error:', itemsError);
    return { profile, items: [] };
  }

  if (!userItems || userItems.length === 0) {
    return { profile, items: [] };
  }

  // 3. Fetch PRODUCTS (Global catalog) to fill gaps
  // We collect all URLs from the user's items to batch fetch product data
  const urls = userItems.map(i => i.url).filter(Boolean);
  
  let productMap = new Map();
  
  if (urls.length > 0) {
    const { data: productData } = await supabase
      .from('products')
      .select('url, image, price')
      .in('url', urls);

    // Create a lookup map for faster access
    productData?.forEach(p => {
      productMap.set(p.url, { image: p.image, price: p.price });
    });
  }

  // 4. Merge and Sanitize Data
  const sanitizedItems: PublicItem[] = userItems.map((item) => {
    const catalogProduct = productMap.get(item.url);
    
    // Logic: Use Item data first -> Fallback to Catalog data -> Default to null
    let finalImage = item.image_url || catalogProduct?.image || null;
    let finalPrice = item.current_price;

    // Handle price string conversions if catalog price is needed
    if ((finalPrice === null || finalPrice === 0) && catalogProduct?.price) {
      const catalogPrice = typeof catalogProduct.price === 'string' 
        ? parseFloat(catalogProduct.price.replace(/[^0-9.]/g, ''))
        : Number(catalogProduct.price);
      if (!isNaN(catalogPrice) && catalogPrice > 0) {
        finalPrice = catalogPrice;
      }
    }
    
    // Ensure numeric price type for the frontend
    if (typeof finalPrice === 'string') {
      finalPrice = parseFloat(finalPrice.toString().replace(/[^0-9.]/g, ''));
    }
    
    if (finalPrice !== null && (isNaN(finalPrice) || finalPrice === 0)) {
      finalPrice = null;
    }

    return {
      id: item.id,
      title: item.title || 'Untitled Item',
      current_price: finalPrice,
      image_url: finalImage,
      retailer: item.retailer || 'Unknown Store',
      url: item.url,
      created_at: item.created_at
    };
  });

  return { profile, items: sanitizedItems };
}

