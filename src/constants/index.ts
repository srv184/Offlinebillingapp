export const DB_DIRS = {
  primary: 'primary_db',
  secondary: 'secondary_db',
};

export const DB_FILENAMES = {
  primary: 'primary.db',
  secondary: 'secondary.db',
};

export const SCHEMA_VERSION = 1;

export const REQUIRED_TABLES = [
  'users',
  'articles',
  'article_sizes',
  'bills',
  'bill_items',
  'app_settings',
  'draft_bills',
  'draft_bill_items',
  'applied_operations',
  'bill_counter',
  'schema_meta',
];

export const DEFAULT_INACTIVITY_TIMEOUT_MINUTES = 30;

export const INACTIVITY_TIMEOUT_OPTIONS = [
  { label: '15 minutes', minutes: 15 },
  { label: '30 minutes', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: 'Never (not recommended)', minutes: -1 },
];

export const SETTINGS_KEYS = {
  inactivityTimeoutMinutes: 'inactivity_timeout_minutes',
  businessName: 'business_name',
  lastAuthenticatedAt: 'last_authenticated_at',
  lastBackgroundedAt: 'last_backgrounded_at',
};

export const SECURE_STORE_KEYS = {
  userName: 'auth_user_name',
  pinHash: 'auth_pin_hash',
  pinSalt: 'auth_pin_salt',
  isSetupComplete: 'auth_setup_complete',
};

export const BILL_NUMBER_PREFIX = 'INV';
export const BILL_NUMBER_PAD_LENGTH = 6;

export const JOURNAL_FILENAME = 'sync_journal.jsonl';
export const RECOVERY_LOG_FILENAME = 'recovery_log.jsonl';
export const BACKUPS_DIR = 'backups';
