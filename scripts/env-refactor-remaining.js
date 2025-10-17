#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const files = [
  'app/api/availability/route.js',
  'app/api/admin/billing/logs/route.js',
  'app/api/cron/sync/route.js',
];

const replacements = {
  "process.env.MONGO_URL": "env.MONGO_URL",
  "process.env.DB_NAME": "env.DB_NAME",
  "process.env.JWT_SECRET": "env.JWT_SECRET",
  "process.env.GOOGLE_CLIENT_ID": "env.GOOGLE?.CLIENT_ID",
  "process.env.GOOGLE_CLIENT_SECRET": "env.GOOGLE?.CLIENT_SECRET",
  "process.env.GOOGLE_REDIRECT_URI": "env.GOOGLE?.REDIRECT_URI",
  "process.env.RESEND_API_KEY": "env.RESEND_API_KEY",
  "process.env.EMAIL_FROM": "env.EMAIL_FROM",
  "process.env.EMAIL_REPLY_TO": "env.EMAIL_REPLY_TO",
  "process.env.NEXT_PUBLIC_BASE_URL": "env.BASE_URL",
  "process.env.APP_BASE_URL": "env.BASE_URL",
  "process.env.CORS_ORIGINS": "'*'",
  "process.env.ADMIN_EMAILS": "''",
  "process.env.CRON_SECRET": "env.CRON_SECRET",
  "process.env.CRON_LOGS": "env.DEBUG_LOGS",
};

files.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipping ${file} (not found)`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  if (!content.includes("from '@/app/lib/env'")) {
    const importRegex = /^import .* from .*$/gm;
    const imports = content.match(importRegex);
    if (imports && imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      content = content.replace(lastImport, lastImport + "\nimport { env } from '@/app/lib/env'");
      changed = true;
    }
  }
  
  Object.entries(replacements).forEach(([from, to]) => {
    if (content.includes(from)) {
      content = content.replaceAll(from, to);
      changed = true;
    }
  });
  
  const jwtSecretRegex = /function getJwtSecret\(\) \{ return process\.env\.JWT_SECRET \|\| ['"]dev-secret-change-me['"] \}\n?/g;
  if (jwtSecretRegex.test(content)) {
    content = content.replace(jwtSecretRegex, '');
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated ${file}`);
  } else {
    console.log(`ℹ️  No changes for ${file}`);
  }
});

console.log('\n✨ Remaining files refactored!');
