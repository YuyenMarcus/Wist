import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // 1. Setup Supabase with Cookies (Just like "Add Item")
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Ignore write errors
            }
          },
        },
      }
    );
    
    // 2. Verify User
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Get ID from the BODY (because this is a POST request)
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing Item ID' }, { status: 400 });
    }

    // 4. Perform the Delete
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id); // Strict ownership check

    if (error) {
      console.error("❌ Delete Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("✅ Item deleted successfully via POST:", id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("❌ Server Error in DELETE POST:", error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}



