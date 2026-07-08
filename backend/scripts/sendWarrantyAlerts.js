import 'dotenv/config';
import nodemailer from 'nodemailer';
import { connectDB } from '../config/db.js';
import { Part, PC } from '../config/models.js';

async function main() {
  await connectDB();

  const dryRun = process.argv.includes('--dry-run');
  const days = parseInt(process.env.WARRANTY_ALERT_DAYS || '30', 10);
  const today = new Date();
  const cutoff = new Date(today.getTime() + days * 86400000);

  let parts = await Part.find({}).lean();
  parts = parts.filter(p => p.warranty_expiry && new Date(p.warranty_expiry) >= today && new Date(p.warranty_expiry) <= cutoff);
  parts.sort((a, b) => new Date(a.warranty_expiry) - new Date(b.warranty_expiry));

  if (parts.length === 0) {
    console.log('No warranties expiring within', days, 'days.');
    process.exit(0);
  }

  const enriched = [];
  for (const part of parts) {
    let location = 'inventory';
    if (part.pc_id) {
      const pc = await PC.findById(part.pc_id).lean();
      location = pc ? `PC: ${pc.name}` : 'unknown PC';
    } else if (part.employee_id) {
      location = 'assigned to employee';
    }
    enriched.push({ ...part, location });
  }

  const alertEmail = process.env.ALERT_EMAIL_TO;
  if (!alertEmail) {
    console.log('ALERT_EMAIL_TO not set — printing results:');
    for (const p of enriched) {
      console.log(`  ${p.brand} ${p.model} (SN: ${p.serial_number || '—'}) — expires ${new Date(p.warranty_expiry).toISOString().split('T')[0]} (${p.location})`);
    }
    process.exit(0);
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: parseInt(process.env.SMTP_PORT || '465', 10) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });

  const lines = enriched.map(
    (p) => `  • ${p.brand} ${p.model} (SN: ${p.serial_number || '—'}) — warranty ends ${new Date(p.warranty_expiry).toISOString().split('T')[0]} — ${p.location}`,
  );

  const mail = {
    from: process.env.SMTP_FROM || 'pc-vault@localhost',
    to: alertEmail,
    subject: `PC Vault — ${parts.length} warranty(ies) expiring within ${days} days`,
    text: [
      `The following ${parts.length} item(s) have warranties expiring in the next ${days} days:\n`,
      ...lines,
      '\n— PC Vault',
    ].join('\n'),
  };

  if (dryRun) {
    console.log('=== DRY RUN — no email sent ===');
    console.log('To:', mail.to);
    console.log('Subject:', mail.subject);
    console.log(mail.text);
  } else {
    await transporter.sendMail(mail);
    console.log('Alert email sent to', alertEmail);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Warranty alerts failed:', err);
  process.exit(1);
});
