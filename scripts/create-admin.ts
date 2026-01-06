/**
 * Script to create admin user in Supabase
 * Run with: npm run create-admin
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const ADMIN_EMAIL = 'julien@nitron.digital';
const ADMIN_PASSWORD = 'JulienAdam0!';

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing environment variables!');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    console.error('\nMake sure these are set in your .env.local file');
    process.exit(1);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    console.log(`🔐 Creating/updating admin user: ${ADMIN_EMAIL}`);

    // List all users to check if exists
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = usersData.users.find(u => u.email === ADMIN_EMAIL);

    if (existingUser) {
      console.log('⚠️  User already exists. Updating...');
      
      const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        {
          email_confirm: true,
          password: ADMIN_PASSWORD,
          user_metadata: {
            ...existingUser.user_metadata,
            role: 'admin',
            updated_by: 'admin-setup-script'
          }
        }
      );

      if (updateError) throw updateError;

      console.log('✅ Admin user updated successfully!');
      console.log(`   User ID: ${updatedUser.user.id}`);
      console.log(`   Email: ${updatedUser.user.email}`);
      console.log(`   Email Confirmed: ${updatedUser.user.email_confirmed_at ? 'Yes ✅' : 'No ❌'}`);
    } else {
      console.log('📝 Creating new admin user...');
      
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: {
          role: 'admin',
          created_by: 'admin-setup-script'
        }
      });

      if (createError) throw createError;

      console.log('✅ Admin user created successfully!');
      console.log(`   User ID: ${newUser.user.id}`);
      console.log(`   Email: ${newUser.user.email}`);
      console.log(`   Email Confirmed: ${newUser.user.email_confirmed_at ? 'Yes ✅' : 'No ❌'}`);
    }

    console.log('\n🎉 Setup complete!');
    console.log(`\nYou can now log in with:`);
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`\nNote: Email verification is bypassed for this account.`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.details) {
      console.error('Details:', error.details);
    }
    process.exit(1);
  }
}

main();

