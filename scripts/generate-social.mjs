#!/usr/bin/env node

// ============================================
// CRAFTREE — Social Content Generator + Publer
// ============================================
// Generates content for X, Reddit, HN, and email.
// X posts/threads → pushed as drafts to Publer (review in Publer app)
// Reddit/HN/Email → saved in Supabase social_content table (copy-paste)
//
// Usage:
//   node scripts/generate-social.mjs --platform all --limit 7
//   node scripts/generate-social.mjs --platform x --type daily --limit 7
//   node scripts/generate-social.mjs --platform x --type thread --limit 1
//   node scripts/generate-social.mjs --platform reddit --limit 1
//   node scripts/generate-social.mjs --platform hn --limit 1
//   node scripts/generate-social.mjs --platform email --limit 1
//   node scripts/generate-social.mjs --dry-run --platform all
//
// Setup:
//   1. Create a Publer account (Business plan for API, $10/mo)
//   2. Connect your X account in Publer
//   3. Get your API key: Settings → Access & Login → API Keys
//   4. Get your Workspace ID: run the --setup flag
//   5. Get your X Account ID: run the --setup flag
//   6. Add to .env.local:
//      PUBLER_API_KEY=your_key
//      PUBLER_WORKSPACE_ID=your_workspace_id
//      PUBLER_X_ACCOUNT_ID=your_x_account_id
//
// First-time setup helper:
//   node scripts/generate-social.mjs --setup
//
// Env: loads project root `.env` then `.env.local` (overrides), like a typical Next.js setup.
// ============================================

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env"), quiet: true });
dotenv.config({ path: join(root, ".env.local"), override: true, quiet: true });

// --- Config ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Publer config
const PUBLER_API_KEY = process.env.PUBLER_API_KEY;
const PUBLER_WORKSPACE_ID = process.env.PUBLER_WORKSPACE_ID;
const PUBLER_X_ACCOUNT_ID = process.env.PUBLER_X_ACCOUNT_ID;
const PUBLER_BASE_URL = "https://app.publer.com/api/v1";

const SITE_URL = "https://craftree.app";
const X_HANDLE = "@Craftree_app";
const MODEL = "claude-haiku-4-5-20251001";

// --- Parse CLI args ---
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
};
const hasFlag = (name) => args.includes(`--${name}`);

const PLATFORM = getArg("platform") || "all";
const TYPE = getArg("type") || null;
const LIMIT = parseInt(getArg("limit") || "7");
const DRY_RUN = hasFlag("dry-run");
const SETUP = hasFlag("setup");

// ============================================
// PUBLER API HELPERS
// ============================================

async function publerRequest(endpoint, method = "GET", body = null) {
  const headers = {
    Authorization: `Bearer-API ${PUBLER_API_KEY}`,
    "Content-Type": "application/json",
    Accept: "*/*",
  };

  // Add workspace ID for non-workspace endpoints
  if (PUBLER_WORKSPACE_ID) {
    headers["Publer-Workspace-Id"] = PUBLER_WORKSPACE_ID;
  }

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${PUBLER_BASE_URL}${endpoint}`, options);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Publer API error ${response.status}: ${text}`);
  }

  return response.json();
}

// --setup: retrieve workspace ID and account IDs
async function runSetup() {
  console.log("🔧 Publer Setup — Retrieving your IDs\n");

  if (!PUBLER_API_KEY) {
    console.log("❌ Set PUBLER_API_KEY in your .env.local first.");
    console.log("   Get it from: Publer → Settings → Access & Login → API Keys");
    process.exit(1);
  }

  // Get workspaces
  console.log("📂 Workspaces:");
  const workspaces = await publerRequest("/workspaces");
  for (const ws of workspaces) {
    console.log(`   ID: ${ws.id}  |  Name: ${ws.name}  |  Role: ${ws.role}`);
  }

  if (workspaces.length > 0) {
    // Get accounts from first workspace
    const wsId = workspaces[0].id;
    const accountHeaders = {
      Authorization: `Bearer-API ${PUBLER_API_KEY}`,
      "Publer-Workspace-Id": wsId,
      Accept: "*/*",
    };

    const accountResponse = await fetch(`${PUBLER_BASE_URL}/accounts`, {
      headers: accountHeaders,
    });
    const accounts = await accountResponse.json();

    console.log(`\n📱 Accounts in "${workspaces[0].name}":`);
    for (const acc of accounts) {
      console.log(`   ID: ${acc.id}  |  ${acc.provider}  |  ${acc.name}  |  ${acc.type}`);
    }

    const twitterAcc = accounts.find((a) => a.provider === "twitter");

    console.log("\n✅ Add these to your .env.local:");
    console.log(`   PUBLER_WORKSPACE_ID=${wsId}`);
    if (twitterAcc) {
      console.log(`   PUBLER_X_ACCOUNT_ID=${twitterAcc.id}`);
    } else {
      console.log("   ⚠️  No X/Twitter account found — connect one in Publer first");
    }
  }

  process.exit(0);
}

// Push a single tweet as a draft
async function pushXDraftToPubler(text) {
  const payload = {
    bulk: {
      state: "draft",
      posts: [
        {
          networks: {
            twitter: {
              type: "status",
              text: text,
            },
          },
          accounts: [{ id: PUBLER_X_ACCOUNT_ID }],
        },
      ],
    },
  };

  return publerRequest("/posts/schedule", "POST", payload);
}

// Push a thread as multiple sequential drafts
async function pushXThreadToPubler(tweets) {
  const posts = tweets.map((text) => ({
    networks: {
      twitter: {
        type: "status",
        text: text,
      },
    },
    accounts: [{ id: PUBLER_X_ACCOUNT_ID }],
  }));

  return publerRequest("/posts/schedule", "POST", {
    bulk: { state: "draft", posts },
  });
}

// Wait for async Publer job
async function waitForJob(jobId, maxRetries = 10) {
  for (let i = 0; i < maxRetries; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const status = await publerRequest(`/job_status/${jobId}`);
    if (status.status === "complete") return status;
    if (status.status === "error")
      throw new Error(`Publer job failed: ${JSON.stringify(status)}`);
  }
  throw new Error("Publer job timed out");
}

// ============================================
// FIND INTERESTING INVENTIONS
// ============================================

async function getHighComplexityInventions(limit = 10) {
  const { data, error } = await supabase
    .from("nodes")
    .select(
      "id, name_en, description_en, year_approx, image_url, complexity_depth, dimension, material_level, category"
    )
    .gt("complexity_depth", 4)
    .not("name_en", "is", null)
    .not("description_en", "is", null)
    .order("complexity_depth", { ascending: false })
    .limit(limit * 3);

  if (error) throw error;
  return data.sort(() => Math.random() - 0.5).slice(0, limit);
}

async function getInventionWithDependencies(inventionId) {
  const { data: links, error } = await supabase
    .from("links")
    .select(
      "source_id, nodes!links_source_id_fkey(name_en, dimension, material_level)"
    )
    .eq("target_id", inventionId);

  if (error) throw error;
  return links;
}

async function getInventionChain(limit = 1) {
  const { data, error } = await supabase
    .from("nodes")
    .select("id, name_en, description_en, complexity_depth, image_url")
    .gt("complexity_depth", 7)
    .not("name_en", "is", null)
    .order("complexity_depth", { ascending: false })
    .limit(limit * 3);

  if (error) throw error;

  const enriched = [];
  for (const inv of data.sort(() => Math.random() - 0.5).slice(0, limit)) {
    const deps = await getInventionWithDependencies(inv.id);
    enriched.push({
      ...inv,
      dependencies: deps.map((l) => ({
        name: l.nodes?.name_en,
        dimension: l.nodes?.dimension,
        material_level: l.nodes?.material_level,
      })),
    });
  }
  return enriched;
}

// ============================================
// PROMPT TEMPLATES
// ============================================

const PROMPTS = {
  x_daily: (invention, deps) => `
You write short, engaging tweets for ${X_HANDLE} (Craftree — an interactive tech tree that shows what it takes to make anything).

Write ONE tweet about this invention. Rules:
- MUST be under 280 characters (including the URL)
- Include 1-2 relevant emojis
- Include a surprising or counter-intuitive fact about what's needed to make it
- End with the link: ${SITE_URL}/tree/${invention.id}
- Tone: educational, intriguing, conversational — NOT salesy
- Do NOT use hashtags in the tweet body

Invention: ${invention.name_en}
Description: ${invention.description_en}
Complexity depth: ${invention.complexity_depth} layers
Year: ${invention.year_approx ?? "unknown"}
Direct inputs: ${deps.map((d) => d.name).filter(Boolean).join(", ")}
Number of direct inputs: ${deps.length}

Reply with ONLY the tweet text, nothing else.`,

  x_thread: (invention, deps) => `
You write engaging Twitter/X threads for ${X_HANDLE} (Craftree — an interactive tech tree showing what it takes to make anything).

Write a thread of 5-7 tweets tracing the fabrication chain of "${invention.name_en}". Rules:
- Tweet 1: Hook — ask a surprising question or state a counter-intuitive fact
- Tweets 2-6: Each tweet = one step in the chain, from raw materials up to the final product
- Last tweet: CTA to explore the full tree on ${SITE_URL}/tree/${invention.id}
- Each tweet MUST be under 280 characters
- Use emojis sparingly (1-2 per tweet max)
- Make it feel like a journey/story, not a list
- Tone: educational, fascinating, like a mini-documentary

Invention: ${invention.name_en}
Complexity depth: ${invention.complexity_depth} layers
Dependencies: ${deps
    .map((d) => `${d.name} (${d.dimension}/${d.material_level})`)
    .filter((d) => d !== "undefined")
    .join(", ")}

Reply with ONLY the tweets, separated by "---" on its own line. No numbering, no labels.`,

  reddit: (invention, deps, subreddit) => {
    const subredditContexts = {
      "r/factorio":
        'You\'re posting in r/factorio, a community of players who love production chains and tech trees. Angle: "I built a real-life version of Factorio\'s tech tree"',
      "r/satisfactory":
        'You\'re posting in r/satisfactory, a community of factory-building game fans. Angle: "Real-world production chains are even more complex than Satisfactory"',
      "r/dataisbeautiful":
        "You're posting in r/dataisbeautiful, a community that loves data visualizations. Focus on the data: number of dependencies, layers of transformation.",
      "r/interestingasfuck":
        "You're posting in r/interestingasfuck. The post needs to be genuinely mind-blowing. Lead with the most surprising fact.",
      "r/technology":
        "You're posting in r/technology. Focus on the hidden complexity behind everyday tech products.",
    };

    return `
You write Reddit posts for Craftree (craftree.app) — an interactive tech tree that shows what it takes to make anything, like a real-life Factorio recipe book.

${subredditContexts[subreddit] || "Write an engaging, informative Reddit post."}

Write a Reddit post (title + body) about "${invention.name_en}". Rules:
- Title: engaging but NOT clickbait. Reddit hates clickbait.
- Body: 3-5 short paragraphs. Informative, genuine, not promotional.
- Mention craftree.app naturally (not as an ad — as a tool you built/found)
- Include specific numbers (X raw materials, Y layers of transformation)
- End with an invitation to explore, not a hard sell
- Reddit tone: conversational, humble, community-oriented

Invention: ${invention.name_en}
Description: ${invention.description_en}
Complexity depth: ${invention.complexity_depth} layers
Direct inputs: ${deps.map((d) => d.name).filter(Boolean).join(", ")}
Number of direct inputs: ${deps.length}

Reply in this format:
TITLE: [your title]
---
BODY: [your post body]`;
  },

  hackernews: () => `
Write a "Show HN" post for Hacker News about Craftree (${SITE_URL}).

Craftree is an interactive technology tree that models human inventions as fabrication recipes — answering "what does it take to make X?" Each invention is decomposed into its material inputs, tools, energy sources, and prerequisite knowledge, recursively down to raw materials.

Built by a solo non-developer using AI-assisted coding (Cursor + Claude). Stack: Next.js, Supabase, Vercel. The database is populated via Claude API scripts.

Rules:
- Title: "Show HN: " format, clear and descriptive, under 80 chars
- Body: 3-4 short paragraphs max. HN values substance over hype.
- Mention the tech stack briefly
- Be honest about limitations and what's next
- HN tone: technical, humble, matter-of-fact

Reply in this format:
TITLE: [your title]
---
BODY: [your post body]`,

  email_digest: (inventions) => `
You write a weekly newsletter for Craftree (${SITE_URL}) — an interactive tech tree showing what it takes to make anything.

Write a short, engaging weekly digest email. Rules:
- Subject line: intriguing, under 60 chars
- Brief intro (2 sentences max)
- Feature 3 inventions with a one-line surprising fact each + link
- Brief closing with CTA to explore
- Tone: friendly, educational, not corporate
- Keep the entire email under 200 words
- Links format: ${SITE_URL}/tree/[id]

This week's featured inventions:
${inventions
  .map(
    (i) =>
      `- ${i.name_en} (depth: ${i.complexity_depth}, id: ${i.id}): ${i.description_en?.slice(0, 100)}`
  )
  .join("\n")}

Reply in this format:
SUBJECT: [subject line]
---
BODY: [email body in plain text, with links]`,
};

// ============================================
// GENERATE CONTENT
// ============================================

async function callClaude(prompt) {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
  return response.content[0].text.trim();
}

async function generateXDaily(limit) {
  console.log(`\n🐦 Generating ${limit} X daily posts...`);
  const inventions = await getHighComplexityInventions(limit);
  const results = [];

  for (const inv of inventions) {
    const deps = await getInventionWithDependencies(inv.id);
    const depNames = deps.map((d) => ({
      name: d.nodes?.name_en,
      dimension: d.nodes?.dimension,
      material_level: d.nodes?.material_level,
    }));

    const content = await callClaude(PROMPTS.x_daily(inv, depNames));

    results.push({
      platform: "x_post",
      content_type: "daily_fact",
      invention_id: inv.id,
      content: content,
      status: "draft",
      language: "en",
    });

    console.log(`  ✅ ${inv.name_en}: "${content.slice(0, 60)}..."`);
  }

  return results;
}

async function generateXThread(limit) {
  console.log(`\n🧵 Generating ${limit} X thread(s)...`);
  const inventions = await getInventionChain(limit);
  const results = [];

  for (const inv of inventions) {
    const content = await callClaude(PROMPTS.x_thread(inv, inv.dependencies));
    const threadParts = content
      .split("---")
      .map((t) => t.trim())
      .filter(Boolean);

    results.push({
      platform: "x_thread",
      content_type: "thread",
      invention_id: inv.id,
      title: `Thread: ${inv.name_en}`,
      content: content,
      thread_parts: threadParts,
      status: "draft",
      language: "en",
    });

    console.log(
      `  ✅ Thread about ${inv.name_en} (${threadParts.length} tweets)`
    );
  }

  return results;
}

async function generateReddit(limit) {
  const subreddits = [
    "r/factorio",
    "r/dataisbeautiful",
    "r/interestingasfuck",
    "r/technology",
    "r/satisfactory",
  ];
  console.log(`\n📮 Generating ${limit} Reddit post(s)...`);

  const inventions = await getHighComplexityInventions(limit);
  const results = [];

  for (let i = 0; i < inventions.length; i++) {
    const inv = inventions[i];
    const subreddit = subreddits[i % subreddits.length];
    const deps = await getInventionWithDependencies(inv.id);
    const depNames = deps.map((d) => ({
      name: d.nodes?.name_en,
      dimension: d.nodes?.dimension,
    }));

    const content = await callClaude(PROMPTS.reddit(inv, depNames, subreddit));
    const [titleLine, ...bodyParts] = content.split("---");
    const title = titleLine.replace("TITLE:", "").trim();
    const body = bodyParts.join("---").replace("BODY:", "").trim();

    results.push({
      platform: "reddit",
      content_type: "daily_fact",
      invention_id: inv.id,
      title: title,
      content: body,
      subreddit: subreddit,
      status: "draft",
      language: "en",
    });

    console.log(`  ✅ ${subreddit}: "${title.slice(0, 60)}..."`);
  }

  return results;
}

async function generateHN() {
  console.log(`\n🟧 Generating Show HN post...`);
  const content = await callClaude(PROMPTS.hackernews());
  const [titleLine, ...bodyParts] = content.split("---");
  const title = titleLine.replace("TITLE:", "").trim();
  const body = bodyParts.join("---").replace("BODY:", "").trim();

  console.log(`  ✅ "${title}"`);
  return [
    {
      platform: "hackernews",
      content_type: "show_hn",
      title,
      content: body,
      status: "draft",
      language: "en",
    },
  ];
}

async function generateEmailDigest() {
  console.log(`\n📧 Generating email digest...`);
  const inventions = await getHighComplexityInventions(3);
  const content = await callClaude(PROMPTS.email_digest(inventions));
  const [subjectLine, ...bodyParts] = content.split("---");
  const subject = subjectLine.replace("SUBJECT:", "").trim();
  const body = bodyParts.join("---").replace("BODY:", "").trim();

  console.log(`  ✅ Subject: "${subject}"`);
  return [
    {
      platform: "email",
      content_type: "weekly_digest",
      title: subject,
      content: body,
      status: "draft",
      language: "en",
    },
  ];
}

// ============================================
// SAVE & PUSH
// ============================================

async function saveAndPush(posts) {
  if (DRY_RUN) {
    console.log("\n🔍 DRY RUN — Preview only:\n");
    for (const post of posts) {
      console.log(
        `━━━ ${post.platform.toUpperCase()} ${post.subreddit ? `(${post.subreddit})` : ""} ━━━`
      );
      if (post.title) console.log(`Title: ${post.title}`);
      console.log(`Content:\n${post.content}`);
      if (post.thread_parts)
        console.log(`Thread: ${post.thread_parts.length} tweets`);
      console.log();
    }
    return;
  }

  // Separate X posts (→ Publer) from others (→ Supabase only)
  const xPosts = posts.filter(
    (p) => p.platform === "x_post" || p.platform === "x_thread"
  );
  const otherPosts = posts.filter(
    (p) => p.platform !== "x_post" && p.platform !== "x_thread"
  );

  // --- Push X content to Publer as drafts ---
  if (xPosts.length > 0 && PUBLER_API_KEY) {
    console.log(
      `\n📤 Pushing ${xPosts.length} X post(s) to Publer as drafts...`
    );

    for (const post of xPosts) {
      try {
        let result;
        if (post.platform === "x_thread" && post.thread_parts) {
          result = await pushXThreadToPubler(post.thread_parts);
          if (result.job_id) await waitForJob(result.job_id);
          console.log(
            `  ✅ Thread "${post.title}" → Publer (${post.thread_parts.length} tweets)`
          );
        } else {
          result = await pushXDraftToPubler(post.content);
          if (result.job_id) await waitForJob(result.job_id);
          console.log(`  ✅ Post → Publer drafts`);
        }
        post.status = "approved"; // Managed in Publer now
      } catch (err) {
        console.error(`  ❌ Publer error: ${err.message}`);
        console.log(`  ⚠️  Kept as draft in Supabase — copy-paste manually`);
      }
    }
  } else if (xPosts.length > 0 && !PUBLER_API_KEY) {
    console.log(
      "\n⚠️  PUBLER_API_KEY not set — X posts saved to Supabase only"
    );
  }

  // --- Save everything to Supabase ---
  const allPosts = [...xPosts, ...otherPosts].map((p) => ({
    platform: p.platform,
    content_type: p.content_type,
    invention_id: p.invention_id || null,
    title: p.title || null,
    content: p.content,
    thread_parts: p.thread_parts || null,
    subreddit: p.subreddit || null,
    status: p.status,
    language: p.language,
  }));

  const { data, error } = await supabase
    .from("social_content")
    .insert(allPosts)
    .select("id, platform, status");

  if (error) {
    console.error("❌ Supabase error:", error.message);
  } else {
    console.log(`\n💾 Saved ${data.length} posts to Supabase.`);
  }

  // Summary
  const publerCount = xPosts.filter((p) => p.status === "approved").length;
  const manualCount = allPosts.length - publerCount;
  console.log("\n📋 Where to find your content:");
  if (publerCount > 0)
    console.log(
      `   🟣 Publer app → Drafts: ${publerCount} X post(s) ready to review & schedule`
    );
  if (manualCount > 0)
    console.log(
      `   🟢 Supabase → social_content table: ${manualCount} post(s) for Reddit/HN/Email (copy-paste)`
    );
}

// ============================================
// MAIN
// ============================================

async function main() {
  // Handle --setup
  if (SETUP) {
    await runSetup();
    return;
  }

  console.log("🌳 Craftree Social Content Generator");
  console.log(
    `   Platform: ${PLATFORM} | Limit: ${LIMIT} | Dry run: ${DRY_RUN}`
  );
  console.log(
    `   Publer: ${PUBLER_API_KEY ? "✅ connected" : "❌ not configured (X → Supabase only)"}`
  );
  console.log("━".repeat(50));

  let allPosts = [];

  try {
    if (PLATFORM === "all" || PLATFORM === "x") {
      if (!TYPE || TYPE === "daily")
        allPosts.push(
          ...(await generateXDaily(PLATFORM === "all" ? 7 : LIMIT))
        );
      if (!TYPE || TYPE === "thread")
        allPosts.push(...(await generateXThread(1)));
    }

    if (PLATFORM === "all" || PLATFORM === "reddit")
      allPosts.push(
        ...(await generateReddit(PLATFORM === "all" ? 2 : LIMIT))
      );

    if (PLATFORM === "all" || PLATFORM === "hn")
      allPosts.push(...(await generateHN()));

    if (PLATFORM === "all" || PLATFORM === "email")
      allPosts.push(...(await generateEmailDigest()));

    await saveAndPush(allPosts);

    console.log(
      `\n💰 Estimated Claude cost: ~$${(allPosts.length * 0.002).toFixed(3)}`
    );
    console.log("✨ Done!");
  } catch (err) {
    console.error("❌ Fatal error:", err.message);
    process.exit(1);
  }
}

main();
