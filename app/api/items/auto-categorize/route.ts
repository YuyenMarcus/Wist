/**
 * Auto-categorize API endpoint
 * 
 * POST /api/items/auto-categorize
 * 
 * Automatically categorizes uncategorized items into collections using keyword matching.
 * Options:
 * - preview: boolean - If true, returns suggestions without applying them
 * - minConfidence: 'high' | 'medium' | 'low' - Minimum confidence level for suggestions
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { batchCategorize, getCategorizationStats, type Item, type Collection } from '@/lib/auto-categorize';

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin');
  return NextResponse.json({}, { status: 200, headers: corsHeaders(origin) });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');

  try {
    // 1. Parse request body
    const body = await request.json().catch(() => ({}));
    const { 
      preview = false, 
      minConfidence = 'medium' 
    } = body as { 
      preview?: boolean; 
      minConfidence?: 'high' | 'medium' | 'low';
    };

    // 2. Authenticate user
    let user = null;
    let supabaseClient = null;

    // Try cookie auth first (for web dashboard)
    const cookieHeader = request.headers.get('cookie') || '';
    const cookieMap = new Map<string, string>();
    if (cookieHeader) {
      cookieHeader.split(';').forEach(cookie => {
        const [name, ...valueParts] = cookie.trim().split('=');
        if (name && valueParts.length > 0) {
          cookieMap.set(name.trim(), valueParts.join('='));
        }
      });
    }

    if (cookieMap.size > 0) {
      const response = NextResponse.next();
      supabaseClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return Array.from(cookieMap.entries()).map(([name, value]) => ({ name, value }));
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieMap.set(name, value);
                response.cookies.set(name, value, options);
              });
            },
          },
        }
      );

      const cookieAuth = await supabaseClient.auth.getUser();
      if (cookieAuth.data?.user) {
        user = cookieAuth.data.user;
      }
    }

    // If no cookie, check Bearer token
    if (!user) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '');
        const { createClient } = await import('@supabase/supabase-js');
        supabaseClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: {
              headers: { Authorization: `Bearer ${token}` },
            },
          }
        );

        const { data: { user: tokenUser }, error } = await supabaseClient.auth.getUser();
        if (!error && tokenUser) {
          user = tokenUser;
        }
      }
    }

    if (!user || !supabaseClient) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders(origin) }
      );
    }

    console.log('🔄 [Auto-Categorize] User:', user.email);

    // 3. Fetch user's collections
    const { data: collections, error: collectionsError } = await supabaseClient
      .from('collections')
      .select('id, name, slug')
      .eq('user_id', user.id);

    if (collectionsError) {
      console.error('❌ [Auto-Categorize] Error fetching collections:', collectionsError);
      return NextResponse.json(
        { error: 'Failed to fetch collections' },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    if (!collections || collections.length === 0) {
      return NextResponse.json(
        { 
          success: true, 
          message: 'No collections found. Create some collections first!',
          stats: { total: 0, categorized: 0, uncategorized: 0, canAutoCategorize: 0 },
          suggestions: [],
          applied: 0
        },
        { headers: corsHeaders(origin) }
      );
    }

    // 4. Fetch user's items
    const { data: items, error: itemsError } = await supabaseClient
      .from('items')
      .select('id, title, url, retailer, collection_id')
      .eq('user_id', user.id);

    if (itemsError) {
      console.error('❌ [Auto-Categorize] Error fetching items:', itemsError);
      return NextResponse.json(
        { error: 'Failed to fetch items' },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { 
          success: true, 
          message: 'No items found.',
          stats: { total: 0, categorized: 0, uncategorized: 0, canAutoCategorize: 0 },
          suggestions: [],
          applied: 0
        },
        { headers: corsHeaders(origin) }
      );
    }

    // 5. Get categorization stats and suggestions
    const stats = getCategorizationStats(items as Item[], collections as Collection[]);
    const suggestions = batchCategorize(items as Item[], collections as Collection[], {
      minConfidence: minConfidence,
      onlyUncategorized: true
    });

    console.log('📊 [Auto-Categorize] Stats:', stats);
    console.log('💡 [Auto-Categorize] Suggestions:', suggestions.length);

    // 6. If preview mode, return suggestions without applying
    if (preview) {
      // Enrich suggestions with collection names and item titles for UI
      const enrichedSuggestions = suggestions.map(s => {
        const item = items.find(i => i.id === s.itemId);
        const collection = collections.find(c => c.id === s.suggestedCollectionId);
        return {
          ...s,
          itemTitle: item?.title || 'Untitled',
          collectionName: collection?.name || 'Unknown'
        };
      });

      return NextResponse.json(
        {
          success: true,
          preview: true,
          stats,
          suggestions: enrichedSuggestions,
          applied: 0
        },
        { headers: corsHeaders(origin) }
      );
    }

    // 7. Apply suggestions (update items with suggested collection_ids)
    let appliedCount = 0;
    const errors: string[] = [];

    for (const suggestion of suggestions) {
      const { error: updateError } = await supabaseClient
        .from('items')
        .update({ collection_id: suggestion.suggestedCollectionId })
        .eq('id', suggestion.itemId)
        .eq('user_id', user.id);

      if (updateError) {
        console.error(`❌ Failed to update item ${suggestion.itemId}:`, updateError);
        errors.push(`Failed to categorize item: ${updateError.message}`);
      } else {
        appliedCount++;
      }
    }

    console.log('✅ [Auto-Categorize] Applied:', appliedCount, 'of', suggestions.length);

    // Enrich suggestions with names for response
    const enrichedSuggestions = suggestions.map(s => {
      const item = items.find(i => i.id === s.itemId);
      const collection = collections.find(c => c.id === s.suggestedCollectionId);
      return {
        ...s,
        itemTitle: item?.title || 'Untitled',
        collectionName: collection?.name || 'Unknown'
      };
    });

    return NextResponse.json(
      {
        success: true,
        preview: false,
        stats,
        suggestions: enrichedSuggestions,
        applied: appliedCount,
        errors: errors.length > 0 ? errors : undefined
      },
      { headers: corsHeaders(origin) }
    );

  } catch (error: any) {
    console.error('❌ [Auto-Categorize] Server Error:', error);
    return NextResponse.json(
      { error: error.message || 'Server Error' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}

// GET endpoint to fetch stats without applying changes
export async function GET(request: Request) {
  const origin = request.headers.get('origin');

  try {
    // Authenticate user (same as POST)
    let user = null;
    let supabaseClient = null;

    const cookieHeader = request.headers.get('cookie') || '';
    const cookieMap = new Map<string, string>();
    if (cookieHeader) {
      cookieHeader.split(';').forEach(cookie => {
        const [name, ...valueParts] = cookie.trim().split('=');
        if (name && valueParts.length > 0) {
          cookieMap.set(name.trim(), valueParts.join('='));
        }
      });
    }

    if (cookieMap.size > 0) {
      const response = NextResponse.next();
      supabaseClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return Array.from(cookieMap.entries()).map(([name, value]) => ({ name, value }));
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieMap.set(name, value);
                response.cookies.set(name, value, options);
              });
            },
          },
        }
      );

      const cookieAuth = await supabaseClient.auth.getUser();
      if (cookieAuth.data?.user) {
        user = cookieAuth.data.user;
      }
    }

    if (!user) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '');
        const { createClient } = await import('@supabase/supabase-js');
        supabaseClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: {
              headers: { Authorization: `Bearer ${token}` },
            },
          }
        );

        const { data: { user: tokenUser }, error } = await supabaseClient.auth.getUser();
        if (!error && tokenUser) {
          user = tokenUser;
        }
      }
    }

    if (!user || !supabaseClient) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders(origin) }
      );
    }

    // Fetch collections and items
    const [collectionsResult, itemsResult] = await Promise.all([
      supabaseClient.from('collections').select('id, name, slug').eq('user_id', user.id),
      supabaseClient.from('items').select('id, title, url, retailer, collection_id').eq('user_id', user.id)
    ]);

    const collections = collectionsResult.data || [];
    const items = itemsResult.data || [];

    const stats = getCategorizationStats(items as Item[], collections as Collection[]);

    return NextResponse.json(
      { success: true, stats },
      { headers: corsHeaders(origin) }
    );

  } catch (error: any) {
    console.error('❌ [Auto-Categorize] Server Error:', error);
    return NextResponse.json(
      { error: error.message || 'Server Error' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
