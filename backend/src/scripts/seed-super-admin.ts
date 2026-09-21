/**
 * Seed Super Admin user
 * Usage: npx tsx src/scripts/seed-super-admin.ts
 *
 * Reads SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD from environment.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const email = process.env.SUPER_ADMIN_EMAIL;
const password = process.env.SUPER_ADMIN_PASSWORD;
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !password || !supabaseUrl || !serviceKey) {
  console.error(
    'Missing SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seed() {
  console.log(`Seeding Super Admin: ${email}`);

  // Find existing user by listing (admin API)
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    throw listError;
  }

  let userId = listData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;

  if (userId) {
    console.log('User already exists, updating password and metadata...');
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { role: 'super_admin', name: 'Super Admin' },
    });
    if (updateError) throw updateError;
  } else {
    console.log('Creating auth user...');
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'super_admin', name: 'Super Admin' },
    });
    if (createError || !created.user) throw createError || new Error('No user returned');
    userId = created.user.id;
  }

  // public.users
  const { error: userError } = await supabase.from('users').upsert(
    { id: userId, email },
    { onConflict: 'id' }
  );
  if (userError) throw userError;

  // profile with super_admin role
  const { data: existingProfile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingProfile) {
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        name: 'Super Admin',
        tier: 'stoics',
        role: 'super_admin',
      })
      .eq('user_id', userId);
    if (profileError) {
      // role column may not exist yet — try without it
      console.warn('Profile update with role failed, retrying without role column:', profileError.message);
      const { error: fallbackError } = await supabase
        .from('user_profiles')
        .update({ name: 'Super Admin', tier: 'stoics' })
        .eq('user_id', userId);
      if (fallbackError) throw fallbackError;
    }
  } else {
    const { error: profileError } = await supabase.from('user_profiles').insert({
      user_id: userId,
      name: 'Super Admin',
      tier: 'stoics',
      role: 'super_admin',
    });
    if (profileError) {
      console.warn('Profile insert with role failed, retrying without role column:', profileError.message);
      const { error: fallbackError } = await supabase.from('user_profiles').insert({
        user_id: userId,
        name: 'Super Admin',
        tier: 'stoics',
      });
      if (fallbackError) throw fallbackError;
    }
  }

  // Ensure stoics subscription
  const { data: tier } = await supabase
    .from('subscription_tiers')
    .select('id')
    .eq('tier_key', 'stoics')
    .maybeSingle();

  if (tier) {
    const { data: existingSub } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingSub) {
      await supabase
        .from('user_subscriptions')
        .update({ tier_id: tier.id, status: 'active' })
        .eq('user_id', userId);
    } else {
      await supabase.from('user_subscriptions').insert({
        user_id: userId,
        tier_id: tier.id,
        status: 'active',
      });
    }
  }

  // Ensure a default project exists
  const { data: existingProjects } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (!existingProjects || existingProjects.length === 0) {
    const { error: projectError } = await supabase.from('projects').insert({
      user_id: userId,
      name: 'My First Project',
      description: 'Default project for your Socratic sessions',
    });
    if (projectError) throw projectError;
    console.log('✓ Default project created');
  }

  console.log(`✓ Super Admin ready: ${email} (${userId})`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
