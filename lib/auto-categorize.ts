/**
 * Auto-categorization utility using keyword matching
 * 
 * This matches item titles, URLs, and retailer info against user-defined collection names
 * to suggest the best collection for uncategorized items.
 * 
 * Future: Can be extended to use LLM for smarter categorization
 */

export interface Collection {
  id: string;
  name: string;
  slug?: string;
}

export interface Item {
  id: string;
  title: string | null;
  url: string;
  retailer?: string | null;
  collection_id?: string | null;
}

export interface CategorizationResult {
  itemId: string;
  suggestedCollectionId: string | null;
  confidence: 'high' | 'medium' | 'low';
  matchReason?: string;
}

// Common category keywords - maps general terms to likely category names
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  // Home & Living
  'kitchen': ['kitchen', 'cookware', 'cooking', 'baking', 'utensil', 'pan', 'pot', 'knife', 'blender', 'mixer', 'coffee', 'espresso', 'toaster', 'microwave', 'dish', 'plate', 'bowl', 'cup', 'mug', 'cutlery', 'spatula', 'whisk'],
  'bedroom': ['bedroom', 'bed', 'mattress', 'pillow', 'blanket', 'duvet', 'sheet', 'comforter', 'nightstand', 'lamp', 'sleep'],
  'bathroom': ['bathroom', 'bath', 'shower', 'towel', 'soap', 'shampoo', 'toilet', 'mirror', 'sink', 'faucet'],
  'living room': ['living', 'sofa', 'couch', 'chair', 'table', 'coffee table', 'tv', 'television', 'console', 'rug', 'carpet', 'curtain', 'lamp'],
  'office': ['office', 'desk', 'chair', 'monitor', 'keyboard', 'mouse', 'laptop', 'computer', 'webcam', 'headset', 'organizer', 'filing'],
  'outdoor': ['outdoor', 'garden', 'patio', 'grill', 'bbq', 'lawn', 'plant', 'flower', 'pot', 'furniture outdoor'],
  
  // Fashion & Accessories  
  'clothing': ['clothing', 'clothes', 'shirt', 'pants', 'jeans', 'dress', 'skirt', 'jacket', 'coat', 'sweater', 'hoodie', 't-shirt', 'blouse', 'shorts'],
  'shoes': ['shoe', 'shoes', 'sneaker', 'boot', 'sandal', 'heel', 'loafer', 'slipper', 'footwear'],
  'accessories': ['accessory', 'accessories', 'watch', 'jewelry', 'necklace', 'bracelet', 'ring', 'earring', 'bag', 'purse', 'wallet', 'belt', 'scarf', 'hat', 'sunglasses'],
  
  // Electronics & Tech
  'electronics': ['electronic', 'electronics', 'tech', 'gadget', 'device', 'smart', 'wireless', 'bluetooth', 'usb', 'charger', 'cable', 'adapter'],
  'gaming': ['gaming', 'game', 'console', 'playstation', 'xbox', 'nintendo', 'switch', 'controller', 'headset gaming'],
  'audio': ['audio', 'speaker', 'headphone', 'earbuds', 'airpods', 'soundbar', 'microphone', 'amp', 'amplifier'],
  'camera': ['camera', 'photo', 'photography', 'lens', 'tripod', 'drone', 'gopro', 'dslr', 'mirrorless'],
  
  // Hobbies & Sports
  'fitness': ['fitness', 'gym', 'workout', 'exercise', 'yoga', 'weight', 'dumbbell', 'kettlebell', 'resistance', 'mat', 'treadmill', 'bike'],
  'sports': ['sport', 'sports', 'ball', 'racket', 'golf', 'tennis', 'basketball', 'football', 'soccer', 'baseball', 'hockey'],
  'books': ['book', 'books', 'reading', 'novel', 'fiction', 'nonfiction', 'kindle', 'ebook'],
  'art': ['art', 'paint', 'painting', 'canvas', 'brush', 'drawing', 'sketch', 'craft', 'supplies'],
  
  // Kids & Baby
  'kids': ['kid', 'kids', 'children', 'child', 'toy', 'toys', 'lego', 'puzzle', 'game board'],
  'baby': ['baby', 'infant', 'toddler', 'nursery', 'stroller', 'crib', 'diaper', 'bottle', 'pacifier'],
  
  // Gifts & Special
  'gifts': ['gift', 'gifts', 'present', 'birthday', 'christmas', 'holiday', 'anniversary', 'wedding'],
  
  // Beauty & Personal Care
  'beauty': ['beauty', 'makeup', 'cosmetic', 'skincare', 'serum', 'moisturizer', 'lipstick', 'mascara', 'foundation', 'brush beauty'],
  'grooming': ['grooming', 'razor', 'shaver', 'trimmer', 'beard', 'hair dryer', 'straightener', 'curler'],
  
  // Food & Drink
  'food': ['food', 'snack', 'gourmet', 'chocolate', 'candy', 'tea', 'wine', 'beer', 'spirits'],
};

// Retailer to category mappings - certain stores are strongly associated with categories
const RETAILER_HINTS: Record<string, string[]> = {
  'williams-sonoma': ['kitchen'],
  'williams sonoma': ['kitchen'],
  'sur la table': ['kitchen'],
  'crate and barrel': ['kitchen', 'living room', 'bedroom'],
  'crate & barrel': ['kitchen', 'living room', 'bedroom'],
  'cb2': ['living room', 'bedroom'],
  'pottery barn': ['living room', 'bedroom', 'bathroom'],
  'west elm': ['living room', 'bedroom'],
  'ikea': ['living room', 'bedroom', 'office', 'kitchen'],
  'wayfair': ['living room', 'bedroom', 'bathroom', 'office'],
  'home depot': ['outdoor', 'bathroom', 'kitchen'],
  'lowes': ['outdoor', 'bathroom', 'kitchen'],
  'nike': ['shoes', 'clothing', 'fitness'],
  'adidas': ['shoes', 'clothing', 'fitness'],
  'lululemon': ['fitness', 'clothing'],
  'sephora': ['beauty'],
  'ulta': ['beauty'],
  'best buy': ['electronics', 'gaming', 'audio'],
  'apple': ['electronics'],
  'amazon': [], // Too generic
  'target': [], // Too generic
  'walmart': [], // Too generic
  'nordstrom': ['clothing', 'shoes', 'accessories'],
  'zappos': ['shoes'],
  'rei': ['outdoor', 'fitness', 'sports'],
  'dick\'s sporting goods': ['sports', 'fitness'],
  'gamestop': ['gaming'],
  'b&h': ['camera', 'electronics', 'audio'],
  'etsy': ['art', 'gifts', 'accessories'],
  'anthropologie': ['clothing', 'accessories', 'living room'],
  'zara': ['clothing'],
  'h&m': ['clothing'],
  'uniqlo': ['clothing'],
};

/**
 * Normalize text for matching - lowercase, remove special chars
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace('www.', '').split('.')[0];
  } catch {
    return '';
  }
}

/**
 * Calculate match score between an item and a collection
 * Returns a score from 0-100 and the reason for the match
 */
function calculateMatchScore(
  item: Item, 
  collection: Collection
): { score: number; reason: string } {
  const collectionName = normalizeText(collection.name);
  const collectionWords = collectionName.split(' ').filter(w => w.length > 2);
  
  const itemTitle = normalizeText(item.title || '');
  const itemUrl = item.url.toLowerCase();
  const itemRetailer = normalizeText(item.retailer || '');
  const domain = extractDomain(item.url);
  
  let bestScore = 0;
  let bestReason = '';
  
  // 1. Direct collection name match in title (highest priority)
  if (itemTitle.includes(collectionName)) {
    return { score: 95, reason: `Title contains "${collection.name}"` };
  }
  
  // 2. Collection word matches in title
  for (const word of collectionWords) {
    if (word.length >= 4 && itemTitle.includes(word)) {
      const score = 85;
      if (score > bestScore) {
        bestScore = score;
        bestReason = `Title contains "${word}"`;
      }
    }
  }
  
  // 3. Check keyword associations
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    // Does this collection match a known category?
    const categoryMatches = collectionWords.some(w => 
      category.includes(w) || w.includes(category.split(' ')[0])
    ) || collectionName.includes(category);
    
    if (categoryMatches) {
      // Check if item title contains any of these category keywords
      for (const keyword of keywords) {
        if (itemTitle.includes(keyword)) {
          const score = 75;
          if (score > bestScore) {
            bestScore = score;
            bestReason = `"${keyword}" matches ${collection.name} category`;
          }
        }
      }
    }
  }
  
  // 4. Retailer-based hints
  const retailerKey = Object.keys(RETAILER_HINTS).find(r => 
    itemRetailer.includes(r) || domain.includes(r.split(' ')[0]) || itemUrl.includes(r.replace(/\s/g, ''))
  );
  
  if (retailerKey) {
    const hintCategories = RETAILER_HINTS[retailerKey];
    for (const hintCat of hintCategories) {
      if (collectionName.includes(hintCat) || collectionWords.some(w => hintCat.includes(w))) {
        const score = 60;
        if (score > bestScore) {
          bestScore = score;
          bestReason = `Retailer "${retailerKey}" suggests ${collection.name}`;
        }
      }
    }
  }
  
  // 5. URL-based matching (lower confidence)
  for (const word of collectionWords) {
    if (word.length >= 4 && itemUrl.includes(word)) {
      const score = 40;
      if (score > bestScore) {
        bestScore = score;
        bestReason = `URL contains "${word}"`;
      }
    }
  }
  
  return { score: bestScore, reason: bestReason };
}

/**
 * Suggest the best collection for an item based on keyword matching
 */
export function suggestCollection(
  item: Item,
  collections: Collection[]
): CategorizationResult {
  if (!collections.length || !item.title) {
    return {
      itemId: item.id,
      suggestedCollectionId: null,
      confidence: 'low',
      matchReason: 'No collections or item title'
    };
  }
  
  let bestMatch: { collection: Collection; score: number; reason: string } | null = null;
  
  for (const collection of collections) {
    const { score, reason } = calculateMatchScore(item, collection);
    
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { collection, score, reason };
    }
  }
  
  if (!bestMatch || bestMatch.score < 40) {
    return {
      itemId: item.id,
      suggestedCollectionId: null,
      confidence: 'low',
      matchReason: 'No confident match found'
    };
  }
  
  const confidence: 'high' | 'medium' | 'low' = 
    bestMatch.score >= 80 ? 'high' :
    bestMatch.score >= 60 ? 'medium' : 'low';
  
  return {
    itemId: item.id,
    suggestedCollectionId: bestMatch.collection.id,
    confidence,
    matchReason: bestMatch.reason
  };
}

/**
 * Batch categorize multiple items
 */
export function batchCategorize(
  items: Item[],
  collections: Collection[],
  options: { 
    minConfidence?: 'high' | 'medium' | 'low';
    onlyUncategorized?: boolean;
  } = {}
): CategorizationResult[] {
  const { minConfidence = 'medium', onlyUncategorized = true } = options;
  
  const confidenceLevels = { high: 3, medium: 2, low: 1 };
  const minLevel = confidenceLevels[minConfidence];
  
  const itemsToProcess = onlyUncategorized 
    ? items.filter(item => !item.collection_id)
    : items;
  
  const results: CategorizationResult[] = [];
  
  for (const item of itemsToProcess) {
    const suggestion = suggestCollection(item, collections);
    
    // Only include results that meet the minimum confidence threshold
    if (suggestion.suggestedCollectionId && 
        confidenceLevels[suggestion.confidence] >= minLevel) {
      results.push(suggestion);
    }
  }
  
  return results;
}

/**
 * Get categorization statistics for a set of items
 */
export function getCategorizationStats(
  items: Item[],
  collections: Collection[]
): {
  total: number;
  categorized: number;
  uncategorized: number;
  canAutoCategorize: number;
} {
  const uncategorizedItems = items.filter(item => !item.collection_id);
  const suggestions = batchCategorize(items, collections, { 
    minConfidence: 'medium',
    onlyUncategorized: true 
  });
  
  return {
    total: items.length,
    categorized: items.length - uncategorizedItems.length,
    uncategorized: uncategorizedItems.length,
    canAutoCategorize: suggestions.length
  };
}
