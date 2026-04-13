/**
 * Seed interests/keywords AND websites into InsightRadar
 * Usage: node scripts/seed-all.js <email> <password> [api_url]
 */

const [,, email, password, apiBase = 'http://localhost:3001'] = process.argv;

if (!email || !password) {
  console.error('Usage: node scripts/seed-all.js <email> <password> [api_url]');
  process.exit(1);
}

const WEBSITES = [
  { url: 'https://www.csis.org', name: 'CSIS', check_interval: 60 },
  { url: 'https://kcnawatch.org', name: 'KCNA Watch', check_interval: 60 },
  { url: 'https://www.politico.com', name: 'Politico', check_interval: 30 },
  { url: 'https://www.aljazeera.com', name: 'Al Jazeera', check_interval: 30 },
  { url: 'https://main.un.org/securitycouncil/en', name: 'UN Security Council', check_interval: 60 },
  { url: 'https://www.congress.gov', name: 'Congress.gov', check_interval: 60 },
];

const KEYWORDS = [
  { keyword: "election integrity", category: "POLITICS", weight: 0.9 },
  { keyword: "voter suppression", category: "POLITICS", weight: 0.85 },
  { keyword: "redistricting", category: "POLITICS", weight: 0.75 },
  { keyword: "campaign finance", category: "POLITICS", weight: 0.85 },
  { keyword: "executive order", category: "POLITICS", weight: 0.9 },
  { keyword: "filibuster", category: "POLITICS", weight: 0.7 },
  { keyword: "judicial appointments", category: "POLITICS", weight: 0.8 },
  { keyword: "Supreme Court", category: "POLITICS", weight: 0.95 },
  { keyword: "constitutional law", category: "POLITICS", weight: 0.85 },
  { keyword: "political polarization", category: "POLITICS", weight: 0.9 },
  { keyword: "populism", category: "POLITICS", weight: 0.8 },
  { keyword: "authoritarianism", category: "POLITICS", weight: 0.85 },
  { keyword: "lobbying", category: "POLITICS", weight: 0.8 },
  { keyword: "impeachment", category: "POLITICS", weight: 0.75 },
  { keyword: "midterm elections", category: "POLITICS", weight: 0.8 },
  { keyword: "political scandal", category: "POLITICS", weight: 0.75 },
  { keyword: "bipartisan legislation", category: "POLITICS", weight: 0.8 },
  { keyword: "democracy backsliding", category: "POLITICS", weight: 0.85 },
  { keyword: "Senate confirmation", category: "POLITICS", weight: 0.75 },
  { keyword: "parliamentary systems", category: "POLITICS", weight: 0.65 },
  { keyword: "political party", category: "POLITICS", weight: 0.85 },
  { keyword: "domestic policy", category: "POLITICS", weight: 0.9 },
  { keyword: "governance reform", category: "POLITICS", weight: 0.7 },
  { keyword: "disinformation", category: "POLITICS", weight: 0.8 },
  { keyword: "political movements", category: "POLITICS", weight: 0.75 },
  { keyword: "far-right", category: "POLITICS", weight: 0.8 },
  { keyword: "progressive politics", category: "POLITICS", weight: 0.75 },
  { keyword: "electoral college", category: "POLITICS", weight: 0.7 },

  { keyword: "NATO", category: "GLOBAL AFFAIRS", weight: 1.0 },
  { keyword: "United Nations Security Council", category: "GLOBAL AFFAIRS", weight: 1.0 },
  { keyword: "nuclear proliferation", category: "GLOBAL AFFAIRS", weight: 0.95 },
  { keyword: "DPRK", category: "GLOBAL AFFAIRS", weight: 0.95 },
  { keyword: "sanctions", category: "GLOBAL AFFAIRS", weight: 0.95 },
  { keyword: "geopolitics", category: "GLOBAL AFFAIRS", weight: 1.0 },
  { keyword: "Indo-Pacific strategy", category: "GLOBAL AFFAIRS", weight: 0.9 },
  { keyword: "BRICS", category: "GLOBAL AFFAIRS", weight: 0.85 },
  { keyword: "G7", category: "GLOBAL AFFAIRS", weight: 0.85 },
  { keyword: "G20", category: "GLOBAL AFFAIRS", weight: 0.85 },
  { keyword: "territorial dispute", category: "GLOBAL AFFAIRS", weight: 0.9 },
  { keyword: "military conflict", category: "GLOBAL AFFAIRS", weight: 0.95 },
  { keyword: "peace negotiations", category: "GLOBAL AFFAIRS", weight: 0.85 },
  { keyword: "foreign policy", category: "GLOBAL AFFAIRS", weight: 1.0 },
  { keyword: "humanitarian aid", category: "GLOBAL AFFAIRS", weight: 0.85 },
  { keyword: "international law", category: "GLOBAL AFFAIRS", weight: 0.9 },
  { keyword: "UN resolution", category: "GLOBAL AFFAIRS", weight: 0.95 },
  { keyword: "trade war", category: "GLOBAL AFFAIRS", weight: 0.9 },
  { keyword: "intelligence agencies", category: "GLOBAL AFFAIRS", weight: 0.8 },
  { keyword: "Arctic geopolitics", category: "GLOBAL AFFAIRS", weight: 0.6 },
  { keyword: "migration crisis", category: "GLOBAL AFFAIRS", weight: 0.85 },
  { keyword: "climate diplomacy", category: "GLOBAL AFFAIRS", weight: 0.8 },
  { keyword: "sovereignty", category: "GLOBAL AFFAIRS", weight: 0.85 },
  { keyword: "Eurasia security", category: "GLOBAL AFFAIRS", weight: 0.8 },
  { keyword: "ceasefire", category: "GLOBAL AFFAIRS", weight: 0.9 },
  { keyword: "defense spending", category: "GLOBAL AFFAIRS", weight: 0.85 },
  { keyword: "proxy war", category: "GLOBAL AFFAIRS", weight: 0.8 },
  { keyword: "alliance treaty", category: "GLOBAL AFFAIRS", weight: 0.75 },

  { keyword: "income inequality", category: "SOCIO-ECONOMIC", weight: 1.0 },
  { keyword: "inflation", category: "SOCIO-ECONOMIC", weight: 0.95 },
  { keyword: "cost of living", category: "SOCIO-ECONOMIC", weight: 0.95 },
  { keyword: "housing crisis", category: "SOCIO-ECONOMIC", weight: 0.9 },
  { keyword: "GDP growth", category: "SOCIO-ECONOMIC", weight: 0.9 },
  { keyword: "labor market", category: "SOCIO-ECONOMIC", weight: 0.9 },
  { keyword: "minimum wage", category: "SOCIO-ECONOMIC", weight: 0.85 },
  { keyword: "wealth gap", category: "SOCIO-ECONOMIC", weight: 0.9 },
  { keyword: "poverty", category: "SOCIO-ECONOMIC", weight: 0.9 },
  { keyword: "tax policy", category: "SOCIO-ECONOMIC", weight: 0.85 },
  { keyword: "recession", category: "SOCIO-ECONOMIC", weight: 0.9 },
  { keyword: "central bank", category: "SOCIO-ECONOMIC", weight: 0.85 },
  { keyword: "Federal Reserve", category: "SOCIO-ECONOMIC", weight: 0.85 },
  { keyword: "interest rates", category: "SOCIO-ECONOMIC", weight: 0.9 },
  { keyword: "public debt", category: "SOCIO-ECONOMIC", weight: 0.85 },
  { keyword: "supply chain", category: "SOCIO-ECONOMIC", weight: 0.8 },
  { keyword: "gig economy", category: "SOCIO-ECONOMIC", weight: 0.75 },
  { keyword: "automation jobs", category: "SOCIO-ECONOMIC", weight: 0.8 },
  { keyword: "universal basic income", category: "SOCIO-ECONOMIC", weight: 0.7 },
  { keyword: "food security", category: "SOCIO-ECONOMIC", weight: 0.85 },
  { keyword: "energy prices", category: "SOCIO-ECONOMIC", weight: 0.85 },
  { keyword: "cryptocurrency regulation", category: "SOCIO-ECONOMIC", weight: 0.75 },
  { keyword: "social mobility", category: "SOCIO-ECONOMIC", weight: 0.8 },
  { keyword: "healthcare costs", category: "SOCIO-ECONOMIC", weight: 0.85 },
  { keyword: "middle class", category: "SOCIO-ECONOMIC", weight: 0.85 },
  { keyword: "consumer spending", category: "SOCIO-ECONOMIC", weight: 0.8 },
  { keyword: "tariffs", category: "SOCIO-ECONOMIC", weight: 0.85 },
  { keyword: "economic sanctions impact", category: "SOCIO-ECONOMIC", weight: 0.75 },

  { keyword: "student debt", category: "EDUCATION", weight: 0.95 },
  { keyword: "education policy", category: "EDUCATION", weight: 1.0 },
  { keyword: "school funding", category: "EDUCATION", weight: 0.9 },
  { keyword: "AI in education", category: "EDUCATION", weight: 0.85 },
  { keyword: "STEM education", category: "EDUCATION", weight: 0.85 },
  { keyword: "teacher shortage", category: "EDUCATION", weight: 0.85 },
  { keyword: "higher education", category: "EDUCATION", weight: 0.95 },
  { keyword: "online learning", category: "EDUCATION", weight: 0.8 },
  { keyword: "EdTech", category: "EDUCATION", weight: 0.75 },
  { keyword: "curriculum reform", category: "EDUCATION", weight: 0.8 },
  { keyword: "education inequality", category: "EDUCATION", weight: 0.9 },
  { keyword: "vocational training", category: "EDUCATION", weight: 0.75 },
  { keyword: "academic freedom", category: "EDUCATION", weight: 0.85 },
  { keyword: "standardized testing", category: "EDUCATION", weight: 0.8 },
  { keyword: "university rankings", category: "EDUCATION", weight: 0.65 },
  { keyword: "research funding", category: "EDUCATION", weight: 0.8 },
  { keyword: "early childhood education", category: "EDUCATION", weight: 0.8 },
  { keyword: "special education", category: "EDUCATION", weight: 0.75 },
  { keyword: "literacy rates", category: "EDUCATION", weight: 0.8 },
  { keyword: "skill gap", category: "EDUCATION", weight: 0.8 },
  { keyword: "workforce development", category: "EDUCATION", weight: 0.8 },
  { keyword: "lifelong learning", category: "EDUCATION", weight: 0.65 },
  { keyword: "college affordability", category: "EDUCATION", weight: 0.9 },
  { keyword: "Department of Education", category: "EDUCATION", weight: 0.85 },
  { keyword: "Title I funding", category: "EDUCATION", weight: 0.7 },
  { keyword: "book banning", category: "EDUCATION", weight: 0.75 },
  { keyword: "charter schools", category: "EDUCATION", weight: 0.75 },
  { keyword: "school choice", category: "EDUCATION", weight: 0.75 },
];

async function run() {
  console.log(`\n🔐 Logging in as "${email}" at ${apiBase}...`);

  const loginRes = await fetch(`${apiBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginData = await loginRes.json();

  if (!loginRes.ok || !loginData.data?.accessToken) {
    console.error('❌ Login failed:', loginData.message || JSON.stringify(loginData));
    process.exit(1);
  }

  const token = loginData.data.accessToken;
  console.log('✅ Logged in.\n');

  // ── 1. Clear existing interests then bulk insert ──────────────────────────
  console.log('🗑️  Clearing existing keywords...');
  const existing = await fetch(`${apiBase}/api/interests`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json());

  const ids = (existing.data || []).map(i => i.id);
  for (const id of ids) {
    await fetch(`${apiBase}/api/interests/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  console.log(`   Removed ${ids.length} old keyword(s).`);

  console.log(`📦 Inserting ${KEYWORDS.length} keywords...`);
  const bulkRes = await fetch(`${apiBase}/api/interests/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ keywords: KEYWORDS }),
  });
  const bulkData = await bulkRes.json();

  if (!bulkRes.ok) {
    console.error('❌ Keyword insert failed:', bulkData.message || JSON.stringify(bulkData));
  } else {
    console.log(`✅ Keywords done! Inserted: ${bulkData.data?.added}  Skipped: ${bulkData.data?.skipped}\n`);
  }

  // ── 2. Clear existing websites then insert ────────────────────────────────
  console.log('🗑️  Clearing existing websites...');
  const existingW = await fetch(`${apiBase}/api/websites`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json());

  const wids = (existingW.data || []).map(w => w.id);
  for (const id of wids) {
    await fetch(`${apiBase}/api/websites/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  console.log(`   Removed ${wids.length} old website(s).`);

  console.log(`🌐 Inserting ${WEBSITES.length} websites...`);
  let wAdded = 0;
  for (const site of WEBSITES) {
    const r = await fetch(`${apiBase}/api/websites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(site),
    });
    const d = await r.json();
    if (r.ok) {
      console.log(`   ✓ ${site.name} (${site.url})`);
      wAdded++;
    } else {
      console.log(`   ✗ ${site.name}: ${d.message || d.error}`);
    }
  }
  console.log(`✅ Websites done! Added: ${wAdded}/${WEBSITES.length}\n`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const byCat = KEYWORDS.reduce((acc, k) => {
    acc[k.category] = (acc[k.category] || 0) + 1;
    return acc;
  }, {});
  console.log('📊 Keyword breakdown:');
  Object.entries(byCat).forEach(([cat, count]) => console.log(`   ${cat}: ${count}`));
  console.log('\n🎉 All done! Open your app → Interests tab to see keywords, Websites tab for sources.\n');
}

run().catch(err => {
  console.error('❌ Unexpected error:', err.message);
  process.exit(1);
});
