import { createClient } from '@supabase/supabase-js';
import { logger } from '../logger';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseAnonKey) {
  logger.error(
    {
      hasUrl: !!supabaseUrl,
      hasServiceRole: !!supabaseServiceRoleKey,
      hasAnonKey: !!supabaseAnonKey,
    },
    'Missing required Supabase environment variables'
  );
  throw new Error('Missing required Supabase configuration');
}

/**
 * Supabase client with SERVICE_ROLE permissions
 * Used for backend operations that bypass RLS policies
 * (e.g., admin operations, seed data)
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Supabase client with ANON permissions
 * Used for client-side operations (respects RLS policies)
 */
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Test Supabase connection on startup
 */
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.from('users').select('id').limit(1);

    if (error) {
      logger.error({ error }, 'Supabase connection test failed');
      return false;
    }

    logger.info('✓ Supabase connection successful');
    return true;
  } catch (error) {
    logger.error({ error }, 'Supabase connection error');
    return false;
  }
}

/**
 * Supabase Storage bucket configuration
 */
export const STORAGE_CONFIG = {
  DOCUMENTS_BUCKET: 'documents',
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE_MB || '10') * 1024 * 1024,
  SUPPORTED_TYPES: (process.env.SUPPORTED_FILE_TYPES || 'pdf,docx,txt,md,json').split(','),
};

/**
 * Create storage bucket if it doesn't exist (initialization)
 */
export async function initializeStorageBuckets(): Promise<void> {
  try {
    // List existing buckets
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();

    if (listError) {
      logger.error({ error: listError }, 'Failed to list storage buckets');
      return;
    }

    // Create documents bucket if it doesn't exist
    const documentsBucketExists = buckets?.some((b) => b.name === STORAGE_CONFIG.DOCUMENTS_BUCKET);

    if (!documentsBucketExists) {
      const { error: createError } = await supabaseAdmin.storage.createBucket(
        STORAGE_CONFIG.DOCUMENTS_BUCKET,
        {
          public: false,
          fileSizeLimit: STORAGE_CONFIG.MAX_FILE_SIZE,
        }
      );

      if (createError) {
        logger.error({ error: createError }, 'Failed to create documents bucket');
      } else {
        logger.info('✓ Documents storage bucket created');
      }
    } else {
      logger.info('✓ Documents storage bucket already exists');
    }
  } catch (error) {
    logger.error({ error }, 'Error initializing storage buckets');
  }
}

/**
 * Database table validation - ensures schema is up to date
 */
export async function validateDatabaseSchema(): Promise<boolean> {
  const requiredTables = [
    'users',
    'user_profiles',
    'projects',
    'sessions',
    'messages',
    'documents',
    'user_api_keys',
    'subscription_tiers',
    'user_subscriptions',
    'usage_logs',
  ];

  try {
    for (const table of requiredTables) {
      const { error } = await supabaseAdmin.from(table).select('id').limit(1);

      if (error) {
        logger.warn({ table, error }, `Table validation failed: ${table}`);
        return false;
      }
    }

    logger.info('✓ Database schema validation passed');
    return true;
  } catch (error) {
    logger.error({ error }, 'Database schema validation error');
    return false;
  }
}

/**
 * Initialize Supabase on application startup
 */
export async function initializeSupabase(): Promise<void> {
  logger.info('Initializing Supabase...');

  const connectionOk = await testSupabaseConnection();
  if (!connectionOk) {
    throw new Error('Failed to connect to Supabase');
  }

  const schemaOk = await validateDatabaseSchema();
  if (!schemaOk) {
    throw new Error(
      'Database schema validation failed. Please run migrations: supabase db push'
    );
  }

  await initializeStorageBuckets();

  logger.info('✓ Supabase initialization complete');
}
