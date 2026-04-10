import nodemailer from 'nodemailer';
import { exportConfig } from './config';

function buildTransporter() {
  if (!exportConfig.gmail.user || !exportConfig.gmail.appPassword) {
    throw new Error('Gmail credentials not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD.');
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: exportConfig.gmail.user,
      pass: exportConfig.gmail.appPassword,
    },
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function buildSuccessHtml({
  date,
  rowCount,
  tableCount,
  sizeBytes,
  attachmentNote,
}: {
  date: string;
  rowCount: number;
  tableCount: number;
  sizeBytes: number;
  attachmentNote: string | null;
}): string {
  const noteHtml = attachmentNote
    ? `<p style="color:#888"><em>${attachmentNote}</em></p>`
    : '';
  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#222;max-width:600px">
  <h2 style="color:#2d7d46">Football Predictions Daily Export — ${date}</h2>
  <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%">
    <tr><td><strong>Export date</strong></td><td>${date}</td></tr>
    <tr><td><strong>Tables exported</strong></td><td>${tableCount}</td></tr>
    <tr><td><strong>Total rows</strong></td><td>${rowCount.toLocaleString()}</td></tr>
    <tr><td><strong>File size</strong></td><td>${formatBytes(sizeBytes)}</td></tr>
  </table>
  ${noteHtml}
</body>
</html>`;
}

function buildFailureHtml({ date, error }: { date: string; error: Error }): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#222;max-width:600px">
  <h2 style="color:#c0392b">&#9888; Football Predictions Export FAILED — ${date}</h2>
  <p><strong>Error:</strong> ${error.message}</p>
  <pre style="background:#f8f8f8;padding:12px;overflow:auto">${error.stack ?? ''}</pre>
</body>
</html>`;
}

export async function sendExportNotification({
  date,
  rowCount,
  tableCount,
  sizeBytes,
  filePath,
  fileName,
  gzipped,
}: {
  date: string;
  rowCount: number;
  tableCount: number;
  sizeBytes: number;
  filePath: string;
  fileName: string;
  gzipped: boolean;
}): Promise<void> {
  const transporter = buildTransporter();
  const maxBytes    = exportConfig.gmail.maxAttachmentSizeMb * 1024 * 1024;
  const attach      = sizeBytes <= maxBytes;
  const mimeType    = gzipped ? 'application/gzip' : 'application/json';
  const attachmentNote = attach
    ? null
    : `File (${formatBytes(sizeBytes)}) exceeds the ${exportConfig.gmail.maxAttachmentSizeMb} MB attachment limit and was not attached.`;

  const subject = exportConfig.gmail.subjectTemplate.replace('{date}', date);

  await transporter.sendMail({
    from:        exportConfig.gmail.user,
    to:          exportConfig.gmail.recipients.join(', '),
    subject,
    html:        buildSuccessHtml({ date, rowCount, tableCount, sizeBytes, attachmentNote }),
    attachments: attach ? [{ filename: fileName, path: filePath, contentType: mimeType }] : [],
  });
}

export async function sendExportAlertEmail({
  date,
  error,
}: {
  date: string;
  error: Error;
}): Promise<void> {
  const transporter = buildTransporter();
  await transporter.sendMail({
    from:    exportConfig.gmail.user,
    to:      exportConfig.gmail.recipients.join(', '),
    subject: `ALERT: Football Predictions Export Failed — ${date}`,
    html:    buildFailureHtml({ date, error }),
  });
}
