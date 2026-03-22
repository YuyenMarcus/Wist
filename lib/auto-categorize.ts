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
  current_price?: number | null;
  price?: number | string | null;
}

export interface CategorizationResult {
  itemId: string;
  suggestedCollectionId: string | null;
  confidence: 'high' | 'medium' | 'low';
  matchReason?: string;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'kitchen': ['kitchen', 'cookware', 'cooking', 'baking', 'utensil', 'pan', 'pot', 'knife', 'blender', 'mixer', 'coffee', 'espresso', 'toaster', 'microwave', 'dish', 'plate', 'bowl', 'cup', 'mug', 'cutlery', 'spatula', 'whisk', 'air fryer', 'instant pot', 'kettle', 'grinder', 'peeler', 'colander', 'wok', 'skillet', 'apron'],
  'bedroom': ['bedroom', 'bed', 'mattress', 'pillow', 'blanket', 'duvet', 'sheet', 'comforter', 'nightstand', 'lamp', 'sleep', 'bedding', 'headboard', 'candle', 'diffuser', 'alarm clock'],
  'bathroom': ['bathroom', 'bath', 'shower', 'towel', 'soap', 'shampoo', 'toilet', 'mirror', 'sink', 'faucet', 'loofah', 'robe', 'bathmat'],
  'living room': ['living', 'sofa', 'couch', 'recliner', 'ottoman', 'coffee table', 'tv', 'television', 'console', 'rug', 'carpet', 'curtain', 'lamp', 'throw', 'candle', 'vase', 'bookshelf', 'shelving'],
  'office': ['office', 'desk', 'monitor', 'keyboard', 'mouse', 'laptop', 'computer', 'webcam', 'headset', 'organizer', 'filing', 'notebook', 'planner', 'pen', 'stationery', 'standing desk', 'mousepad', 'usb hub', 'docking station'],
  'outdoor': ['outdoor', 'garden', 'patio', 'grill', 'bbq', 'lawn', 'plant', 'flower', 'pot', 'hammock', 'tent', 'camping', 'hiking', 'backpack', 'lantern', 'cooler', 'fire pit', 'umbrella patio'],

  'clothing': ['clothing', 'clothes', 'shirt', 'pants', 'jeans', 'dress', 'skirt', 'jacket', 'coat', 'sweater', 'hoodie', 't-shirt', 'blouse', 'shorts', 'leggings', 'cardigan', 'blazer', 'tank top', 'romper', 'jumpsuit', 'sweatshirt', 'vest', 'pajamas', 'underwear', 'lingerie', 'bikini', 'swimsuit', 'swimwear'],
  'shoes': ['shoe', 'shoes', 'sneaker', 'boot', 'sandal', 'heel', 'loafer', 'slipper', 'footwear', 'trainer', 'clog', 'mule', 'espadrille', 'slide', 'flip flop', 'platform'],
  'accessories': ['accessory', 'accessories', 'watch', 'jewelry', 'necklace', 'bracelet', 'ring', 'earring', 'bag', 'purse', 'wallet', 'belt', 'scarf', 'hat', 'sunglasses', 'tote', 'clutch', 'backpack', 'crossbody', 'handbag', 'beanie', 'cap', 'headband', 'hair clip', 'brooch', 'anklet', 'choker', 'pendant', 'chain'],

  'electronics': ['electronic', 'electronics', 'tech', 'gadget', 'device', 'smart', 'wireless', 'bluetooth', 'usb', 'charger', 'cable', 'adapter', 'power bank', 'smart home', 'alexa', 'google home', 'hub', 'sensor', 'thermostat', 'robot vacuum', 'tablet', 'ipad', 'apple watch', 'smartwatch', 'kindle', 'e-reader'],
  'phone': ['phone', 'iphone', 'samsung galaxy', 'pixel', 'phone case', 'screen protector', 'magsafe', 'phone mount', 'phone stand', 'airpods', 'galaxy buds'],
  'gaming': ['gaming', 'game', 'playstation', 'ps5', 'xbox', 'nintendo', 'switch', 'controller', 'headset gaming', 'steam deck', 'razer', 'rgb', 'mechanical keyboard'],
  'audio': ['audio', 'speaker', 'headphone', 'earbuds', 'airpods', 'soundbar', 'microphone', 'amp', 'amplifier', 'turntable', 'vinyl', 'record player', 'subwoofer', 'dac', 'studio monitor'],
  'camera': ['camera', 'photo', 'photography', 'lens', 'tripod', 'drone', 'gopro', 'dslr', 'mirrorless', 'film', 'instant camera', 'polaroid', 'gimbal', 'action camera', 'ring light'],

  'fitness': ['fitness', 'gym', 'workout', 'exercise', 'yoga', 'weight', 'dumbbell', 'kettlebell', 'resistance', 'mat', 'treadmill', 'bike', 'protein', 'pre workout', 'foam roller', 'jump rope', 'pull up bar', 'bench press', 'squat rack', 'rowing machine'],
  'sports': ['sport', 'sports', 'ball', 'racket', 'golf', 'tennis', 'basketball', 'football', 'soccer', 'baseball', 'hockey', 'surfing', 'skateboard', 'snowboard', 'ski', 'climbing', 'boxing', 'gloves'],
  'books': ['book', 'books', 'reading', 'novel', 'fiction', 'nonfiction', 'kindle', 'ebook', 'manga', 'comic', 'graphic novel', 'audiobook', 'bookmarks', 'bookmark'],
  'art': ['art', 'paint', 'painting', 'canvas', 'brush', 'drawing', 'sketch', 'craft', 'supplies', 'marker', 'colored pencil', 'watercolor', 'acrylic', 'calligraphy', 'pottery', 'clay', 'sewing', 'knitting', 'crochet', 'embroidery'],

  'kids': ['kid', 'kids', 'children', 'child', 'toy', 'toys', 'lego', 'puzzle', 'board game', 'stuffed animal', 'doll', 'action figure', 'playset', 'coloring'],
  'baby': ['baby', 'infant', 'toddler', 'nursery', 'stroller', 'crib', 'diaper', 'bottle', 'pacifier', 'onesie', 'swaddle', 'teething', 'high chair', 'car seat', 'baby monitor'],

  'gifts': ['gift', 'gifts', 'present', 'birthday', 'christmas', 'holiday', 'anniversary', 'wedding', 'valentine', 'mother day', 'father day', 'graduation'],

  'beauty': ['beauty', 'makeup', 'cosmetic', 'skincare', 'serum', 'moisturizer', 'lipstick', 'mascara', 'foundation', 'concealer', 'blush', 'bronzer', 'primer', 'setting spray', 'eyeshadow', 'eyeliner', 'nail polish', 'perfume', 'fragrance', 'cologne', 'cleanser', 'toner', 'retinol', 'sunscreen', 'spf', 'face mask'],
  'hair': ['hair', 'shampoo', 'conditioner', 'hair dryer', 'blow dryer', 'straightener', 'curling iron', 'curler', 'hair oil', 'hair mask', 'brush hair', 'comb', 'clip', 'scrunchie'],
  'grooming': ['grooming', 'razor', 'shaver', 'trimmer', 'beard', 'aftershave', 'deodorant', 'body wash'],

  'food': ['food', 'snack', 'gourmet', 'chocolate', 'candy', 'tea', 'wine', 'beer', 'spirits', 'coffee beans', 'sauce', 'spice', 'seasoning', 'olive oil', 'honey', 'jam', 'protein bar', 'supplement', 'vitamin'],

  'car': ['car', 'auto', 'automotive', 'vehicle', 'dash cam', 'car mount', 'tire', 'floor mat', 'car charger', 'car seat cover', 'wiper', 'car wash', 'detailing'],
  'travel': ['travel', 'luggage', 'suitcase', 'carry on', 'travel bag', 'packing cube', 'passport', 'neck pillow', 'travel adapter', 'duffel'],
  'pet': ['pet', 'dog', 'cat', 'puppy', 'kitten', 'collar', 'leash', 'pet bed', 'pet food', 'treats', 'litter', 'aquarium', 'fish tank', 'bird', 'hamster'],
};

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
  'new balance': ['shoes', 'fitness'],
  'puma': ['shoes', 'clothing', 'fitness'],
  'lululemon': ['fitness', 'clothing'],
  'gymshark': ['fitness', 'clothing'],
  'sephora': ['beauty'],
  'ulta': ['beauty'],
  'glossier': ['beauty'],
  'fenty': ['beauty'],
  'best buy': ['electronics', 'gaming', 'audio'],
  'apple': ['electronics', 'phone'],
  'samsung': ['electronics', 'phone'],
  'amazon': [],
  'target': [],
  'walmart': [],
  'nordstrom': ['clothing', 'shoes', 'accessories', 'beauty'],
  'zappos': ['shoes'],
  'rei': ['outdoor', 'fitness', 'sports'],
  'patagonia': ['outdoor', 'clothing'],
  'the north face': ['outdoor', 'clothing'],
  'dick\'s sporting goods': ['sports', 'fitness'],
  'gamestop': ['gaming'],
  'b&h': ['camera', 'electronics', 'audio'],
  'etsy': ['art', 'gifts', 'accessories'],
  'anthropologie': ['clothing', 'accessories', 'living room'],
  'free people': ['clothing'],
  'zara': ['clothing'],
  'h&m': ['clothing'],
  'uniqlo': ['clothing'],
  'shein': ['clothing', 'accessories'],
  'asos': ['clothing', 'shoes', 'accessories'],
  'revolve': ['clothing', 'accessories'],
  'farfetch': ['clothing', 'shoes', 'accessories'],
  'ssense': ['clothing', 'shoes', 'accessories'],
  'mr porter': ['clothing', 'shoes', 'accessories'],
  'net-a-porter': ['clothing', 'shoes', 'accessories'],
  'barnes': ['books'],
  'bookshop': ['books'],
  'chewy': ['pet'],
  'petco': ['pet'],
  'petsmart': ['pet'],
  'bath body works': ['beauty', 'bathroom'],
  'bath & body': ['beauty', 'bathroom'],
  'dyson': ['electronics', 'hair', 'living room'],
  'sonos': ['audio'],
  'bose': ['audio'],
  'marshall': ['audio'],
  'jbl': ['audio'],
  'lego': ['kids'],
  'fisher price': ['baby', 'kids'],
  'away': ['travel'],
  'samsonite': ['travel'],
  'autozone': ['car'],
};

const STEMMING_MAP: Record<string, string> = {
  'shoes': 'shoe', 'sneakers': 'sneaker', 'boots': 'boot', 'sandals': 'sandal',
  'dresses': 'dress', 'shirts': 'shirt', 'pants': 'pant', 'jackets': 'jacket',
  'watches': 'watch', 'bags': 'bag', 'rings': 'ring', 'earrings': 'earring',
  'necklaces': 'necklace', 'bracelets': 'bracelet', 'scarves': 'scarf',
  'candles': 'candle', 'pillows': 'pillow', 'blankets': 'blanket',
  'toys': 'toy', 'games': 'game', 'books': 'book', 'gifts': 'gift',
  'speakers': 'speaker', 'headphones': 'headphone', 'cameras': 'camera',
  'lenses': 'lens', 'vitamins': 'vitamin', 'supplements': 'supplement',
  'plants': 'plant', 'flowers': 'flower', 'tools': 'tool',
  'electronics': 'electronic', 'accessories': 'accessory',
  'cosmetics': 'cosmetic', 'perfumes': 'perfume', 'fragrances': 'fragrance',
};

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function stem(word: string): string {
  return STEMMING_MAP[word] || word;
}

function stemAll(text: string): string {
  return text.split(' ').map(stem).join(' ');
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '').split('.')[0];
  } catch {
    return '';
  }
}

function extractUrlPath(url: string): string {
  try {
    const path = new URL(url).pathname;
    return path.replace(/[^a-z0-9]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  } catch {
    return '';
  }
}

function generateNgrams(text: string, n: number): string[] {
  const words = text.split(' ');
  if (words.length < n) return [];
  const ngrams: string[] = [];
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.push(words.slice(i, i + n).join(' '));
  }
  return ngrams;
}

function textContainsPhrase(text: string, phrase: string): boolean {
  if (phrase.includes(' ')) {
    return text.includes(phrase);
  }
  const words = text.split(' ');
  return words.some(w => w === phrase || stem(w) === phrase || w === stem(phrase));
}

function calculateMatchScore(
  item: Item,
  collection: Collection
): { score: number; reason: string } {
  const collectionName = normalizeText(collection.name);
  const collectionStemmed = stemAll(collectionName);
  const collectionWords = collectionName.split(' ').filter(w => w.length > 2);
  const collectionStemmedWords = collectionStemmed.split(' ').filter(w => w.length > 2);

  const rawTitle = normalizeText(item.title || '');
  const itemTitle = stemAll(rawTitle);
  const itemUrl = item.url.toLowerCase();
  const itemRetailer = normalizeText(item.retailer || '');
  const domain = extractDomain(item.url);
  const urlPath = extractUrlPath(item.url);
  const urlPathStemmed = stemAll(urlPath);

  let bestScore = 0;
  let bestReason = '';

  function update(score: number, reason: string) {
    if (score > bestScore) {
      bestScore = score;
      bestReason = reason;
    }
  }

  // 1. Exact collection name in title (highest)
  if (rawTitle.includes(collectionName) || itemTitle.includes(collectionStemmed)) {
    update(95, `Title contains "${collection.name}"`);
  }

  // 2. Individual collection word matches in title
  for (const word of collectionStemmedWords) {
    if (word.length >= 3 && textContainsPhrase(itemTitle, word)) {
      update(word.length >= 5 ? 88 : 82, `Title contains "${word}"`);
    }
  }

  // 3. Keyword category associations — check both title and URL path
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const categoryNorm = normalizeText(category);
    const categoryStemmed = stemAll(categoryNorm);

    const categoryMatches = collectionStemmedWords.some(w =>
      categoryStemmed.includes(w) || w.includes(categoryStemmed.split(' ')[0])
    ) || collectionStemmed.includes(categoryStemmed) || collectionName.includes(categoryNorm);

    if (!categoryMatches) continue;

    for (const keyword of keywords) {
      const kw = normalizeText(keyword);
      const kwStemmed = stemAll(kw);

      if (textContainsPhrase(itemTitle, kwStemmed) || textContainsPhrase(rawTitle, kw)) {
        update(78, `"${keyword}" matches ${collection.name} category`);
      }

      if (textContainsPhrase(urlPathStemmed, kwStemmed) || urlPath.includes(kw)) {
        update(55, `URL path "${keyword}" matches ${collection.name}`);
      }
    }
  }

  // 4. Retailer-based hints
  const retailerKey = Object.keys(RETAILER_HINTS).find(r =>
    itemRetailer.includes(r) || domain.includes(r.split(' ')[0].replace(/[^a-z]/g, '')) || itemUrl.includes(r.replace(/\s/g, ''))
  );

  if (retailerKey) {
    const hintCategories = RETAILER_HINTS[retailerKey];
    for (const hintCat of hintCategories) {
      const hintStemmed = stemAll(normalizeText(hintCat));
      if (collectionStemmed.includes(hintStemmed) || collectionStemmedWords.some(w => hintStemmed.includes(w))) {
        update(62, `Retailer "${retailerKey}" suggests ${collection.name}`);
      }
    }
  }

  // 5. URL path word matches against collection name
  for (const word of collectionStemmedWords) {
    if (word.length >= 4 && textContainsPhrase(urlPathStemmed, word)) {
      update(50, `URL path contains "${word}"`);
    }
  }

  // 6. N-gram matching in title (2-word phrases from collection name)
  if (collectionWords.length >= 2) {
    const bigrams = generateNgrams(collectionStemmed, 2);
    for (const bigram of bigrams) {
      if (itemTitle.includes(bigram)) {
        update(90, `Title contains "${bigram}"`);
      }
    }
  }

  return { score: bestScore, reason: bestReason };
}

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
    bestMatch.score >= 55 ? 'medium' : 'low';

  return {
    itemId: item.id,
    suggestedCollectionId: bestMatch.collection.id,
    confidence,
    matchReason: bestMatch.reason
  };
}

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

    if (suggestion.suggestedCollectionId &&
        confidenceLevels[suggestion.confidence] >= minLevel) {
      results.push(suggestion);
    }
  }

  return results;
}

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
