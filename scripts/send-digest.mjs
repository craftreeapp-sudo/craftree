#!/usr/bin/env node

// ============================================
// CRAFTREE — Send Email Digest via Resend
// ============================================
// Sends the latest approved email digest to all active subscribers.
//
// Usage:
//   node scripts/send-digest.mjs              # Send to all active subscribers
//   node scripts/send-digest.mjs --test       # Send only to craftree.app@gmail.com
//   node scripts/send-digest.mjs --dry-run    # Preview, don't send
//
// Prerequisites:
//   npm install resend (if not already installed)
//   Set RESEND_API_KEY in your .env
// ============================================

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "Craftree <hello@craftree.app>"; // Configure in Resend dashboard
const TEST_EMAIL = "craftree.app@gmail.com";
const SITE_URL = "https://craftree.app";

const args = process.argv.slice(2);
const TEST_MODE = args.includes("--test");
const DRY_RUN = args.includes("--dry-run");

async function getLatestDigest() {
  const { data, error } = await supabase
    .from("social_content")
    .select("*")
    .eq("platform", "email")
    .eq("content_type", "weekly_digest")
    .eq("status", "approved")
    .is("posted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) throw new Error("No approved email digest found. Generate one first, then approve it.");
  return data;
}

async function getSubscribers() {
  if (TEST_MODE) {
    return [{ email: TEST_EMAIL, name: "Julien (test)" }];
  }

  const { data, error } = await supabase
    .from("subscribers")
    .select("email, name")
    .eq("status", "active");

  if (error) throw error;
  return data;
}

function buildHtmlEmail(digest) {
  // Simple, clean email template — no heavy HTML frameworks needed
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #e5e5e5; margin-bottom: 24px; }
    .header h1 { font-size: 24px; margin: 0; }
    .header h1 a { color: #1a1a1a; text-decoration: none; }
    .content { white-space: pre-line; font-size: 16px; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 13px; color: #666; text-align: center; }
    .footer a { color: #666; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <div class="header">
    <h1><a href="${SITE_URL}">🌳 Craftree</a></h1>
  </div>
  <div class="content">${digest.content.replace(/\n/g, "<br>")}</div>
  <div class="footer">
    <p>You're receiving this because you subscribed to Craftree updates.</p>
    <p><a href="${SITE_URL}/unsubscribe">Unsubscribe</a></p>
  </div>
</body>
</html>`;
}

async function main() {
  console.log("📧 Craftree Email Digest Sender");
  console.log(`   Mode: ${TEST_MODE ? "TEST" : "PRODUCTION"} | Dry run: ${DRY_RUN}`);
  console.log("━".repeat(50));

  try {
    const digest = await getLatestDigest();
    console.log(`\n📝 Digest: "${digest.title}"`);
    console.log(`   Created: ${new Date(digest.created_at).toLocaleDateString()}`);

    const subscribers = await getSubscribers();
    console.log(`   Recipients: ${subscribers.length}`);

    if (DRY_RUN) {
      console.log("\n🔍 DRY RUN — Preview:\n");
      console.log(`Subject: ${digest.title}`);
      console.log(`Body:\n${digest.content}`);
      console.log(`\nWould send to: ${subscribers.map((s) => s.email).join(", ")}`);
      return;
    }

    // Send emails (Resend supports batch sending)
    let sent = 0;
    for (const sub of subscribers) {
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: sub.email,
          subject: digest.title,
          html: buildHtmlEmail(digest),
        });
        sent++;
        console.log(`  ✅ Sent to ${sub.email}`);
      } catch (err) {
        console.error(`  ❌ Failed for ${sub.email}: ${err.message}`);
      }
    }

    // Mark digest as posted
    await supabase
      .from("social_content")
      .update({ status: "posted", posted_at: new Date().toISOString() })
      .eq("id", digest.id);

    console.log(`\n✨ Done! Sent ${sent}/${subscribers.length} emails.`);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

main();
