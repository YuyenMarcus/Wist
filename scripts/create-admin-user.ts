/**
 * Script to create an admin user in Supabase
 * Run with: npx tsx scripts/create-admin-user.ts
 * 
 * This script creates a user with email verification bypassed
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const ADMIN_EMAIL = 'julien@nitron.digital';
const ADMIN_PASSWORD = 'JulienAdam0!';

async function createAdminUser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase credentials!');
    console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
    process.exit(1);
  }

  // Use service role key to bypass RLS and create user
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    console.log(`🔐 Creating admin user: ${ADMIN_EMAIL}`);

    // Create the user (this will fail if user already exists)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true, // Skip email verification
      user_metadata: {
        role: 'admin',
        created_by: 'admin-setup-script'
      }
    });

    if (authError) {
      // If user already exists, update them instead
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        console.log('⚠️  User already exists. Updating user...');
        
        // Get the user by email
        const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;

        const existingUser = users.users.find(u => u.email === ADMIN_EMAIL);
        if (!existingUser) {
          throw new Error('User exists but could not be found');
        }

        // Update the user to confirm email and set password
        const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          existingUser.id,
          {
            email_confirm: true,
            password: ADMIN_PASSWORD,
            user_metadata: {
              role: 'admin',
              updated_by: 'admin-setup-script'
            }
          }
        );

        if (updateError) throw updateError;
        console.log('✅ Admin user updated successfully!');
        console.log(`   User ID: ${updatedUser.user.id}`);
        console.log(`   Email: ${updatedUser.user.email}`);
        console.log(`   Email Confirmed: ${updatedUser.user.email_confirmed_at ? 'Yes' : 'No'}`);
      } else {
        throw authError;
      }
    } else {
      console.log('✅ Admin user created successfully!');
      console.log(`   User ID: ${authData.user.id}`);
      console.log(`   Email: ${authData.user.email}`);
      console.log(`   Email Confirmed: ${authData.user.email_confirmed_at ? 'Yes' : 'No'}`);
    }

    console.log('\n🎉 Setup complete!');
    console.log(`\nYou can now log in with:`);
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`\nNote: Email verification is bypassed for this account.`);

  } catch (error: any) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  }
}

createAdminUser();

