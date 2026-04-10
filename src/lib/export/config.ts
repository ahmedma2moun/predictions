export const exportConfig = {
  outputDir: process.env.EXPORT_OUTPUT_DIR || '/tmp/exports',
  gzipThresholdMb: Number(process.env.EXPORT_GZIP_THRESHOLD_MB ?? 50),
  sourceSystem: process.env.EXPORT_SOURCE_SYSTEM || 'Football Predictions',
  schemaVersion: '1.0.0',

  // Strip these columns before serialization — password hashes must never leave the server
  excludeColumns: {
    User: ['password'],
  } as Record<string, string[]>,

  gmail: {
    user: process.env.GMAIL_USER || '',
    appPassword: process.env.GMAIL_APP_PASSWORD || '',
    recipients: (process.env.GMAIL_RECIPIENTS || '').split(',').filter(Boolean),
    subjectTemplate:
      process.env.GMAIL_SUBJECT_TEMPLATE || 'Football Predictions Daily Export — {date}',
    maxAttachmentSizeMb: Number(process.env.GMAIL_MAX_ATTACHMENT_MB ?? 24),
  },
};
