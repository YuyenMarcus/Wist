/**
 * One-time API endpoint to create admin user
 * Call this once: POST /api/admin/create-user
 * 
 * This creates the admin user with email verification bypassed
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'julien@nitron.digital';
const ADMIN_PASSWORD = 'JulienAdam0!';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Missing Supabase credentials' },
        { status: 500 }
      );
    }

    // Use service role key to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if user already exists
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = users.users.find(u => u.email === ADMIN_EMAIL);

    if (existingUser) {
      // Update existing user
      const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        {
          email_confirm: true, // Skip email verification
          password: ADMIN_PASSWORD,
          user_metadata: {
            ...existingUser.user_metadata,
            role: 'admin',
            updated_by: 'admin-setup-api'
          }
        }
      );

      if (updateError) throw updateError;

      return NextResponse.json({
        success: true,
        message: 'Admin user updated successfully',
        user: {
          id: updatedUser.user.id,
          email: updatedUser.user.email,
          email_confirmed: !!updatedUser.user.email_confirmed_at
        }
      });
    } else {
      // Create new user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true, // Skip email verification
        user_metadata: {
          role: 'admin',
          created_by: 'admin-setup-api'
        }
      });

      if (authError) throw authError;

      return NextResponse.json({
        success: true,
        message: 'Admin user created successfully',
        user: {
          id: authData.user.id,
          email: authData.user.email,
          email_confirmed: !!authData.user.email_confirmed_at
        }
      });
    }
  } catch (error: any) {
    console.error('Error creating admin user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create admin user' },
      { status: 500 }
    );
  }
}

