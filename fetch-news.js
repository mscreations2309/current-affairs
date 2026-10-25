// Fetches news from RSS feeds, keeps only UPSC-relevant stories, tags them by
// GS topic and merges them into data/news.json + data/news.js (archive grows daily).
// Run: node fetch-news.js      (Node 18+ required, no npm packages needed)

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const JSON_FILE = path.join(DATA_DIR, "news.json");
const JS_FILE = path.join(DATA_DIR, "news.js");

// "curated" sources are analysis/editorial content: always kept unless excluded.
const FEEDS = [
  { source: "The Hindu", section: "National", url: "https://www.thehindu.com/news/national/feeder/default.rss" },
  { source: "The Hindu", section: "International", url: "https://www.thehindu.com/news/international/feeder/default.rss" },
  { source: "The Hindu", section: "Economy", url: "https://www.thehindu.com/business/Economy/feeder/default.rss" },
  { source: "The Hindu", section: "Science", url: "https://www.thehindu.com/sci-tech/science/feeder/default.rss" },
  { source: "The Hindu", section: "Environment", url: "https://www.thehindu.com/sci-tech/energy-and-environment/feeder/default.rss" },
  { source: "The Hindu", section: "Health", url: "https://www.thehindu.com/sci-tech/health/feeder/default.rss" },
  { source: "The Hindu", section: "Editorial", url: "https://www.thehindu.com/opinion/editorial/feeder/default.rss", curated: true },
  { source: "Indian Express", section: "Explained", url: "https://indianexpress.com/section/explained/feed/", curated: true },
  { source: "Mint", section: "Economy", url: "https://www.livemint.com/rss/economy" },
];

// Topic -> GS paper + keywords. A story can match several topics.
const TOPICS = {
  "Polity & Governance": {
    gs: "GS-2",
    words: ["constitution", "constitutional", "supreme court", "high court", "parliament", "lok sabha", "rajya sabha",
      "bill", "act", "amendment", "ordinance", "election commission", "governor", "president murmu", "fundamental right",
      "article 370", "article", "federalism", "centre-state", "judiciary", "judicial", "chief justice", "cji", "tribunal",
      "panchayat", "municipal", "delimitation", "one nation one election", "anti-defection", "cag", "upsc", "niti aayog",
      "rti", "lokpal", "governance", "policy", "ministry", "cabinet", "regulation", "statutory", "collegium", "census",
      "caste census", "reservation", "ucc", "uniform civil code", "simultaneous elections", "finance commission", "gst council"],
  },
  "International Relations": {
    gs: "GS-2",
    words: ["bilateral", "summit", "united nations", "unsc", "unga", "g20", "g7", "brics", "sco", "quad", "asean", "saarc",
      "bimstec", "nato", "imf", "world bank", "wto", "world health organization", "treaty", "foreign minister", "external affairs", "jaishankar",
      "diplomat", "diplomatic", "ambassador", "china", "pakistan", "bangladesh", "nepal", "sri lanka", "maldives", "bhutan",
      "myanmar", "afghanistan", "russia", "ukraine", "israel", "gaza", "iran", "u.s.", "united states", "washington", "trump", "european union",
      "indo-pacific", "free trade agreement", "fta", "visa", "sanctions", "ceasefire", "geopolitic*"],
  },
  "Economy": {
    gs: "GS-3",
    words: ["gdp", "inflation", "rbi", "reserve bank", "repo rate", "monetary policy", "fiscal", "budget", "tax", "gst",
      "export", "import", "trade deficit", "current account", "forex", "rupee", "economy", "economic", "msme",
      "manufacturing", "pli", "investment", "fdi", "banking", "bank", "npa", "sebi", "disinvestment", "subsidy",
      "agriculture", "msp", "farmers", "kharif", "rabi", "food security", "unemployment", "employment", "labour code",
      "infrastructure", "railway", "highway", "port", "logistics", "digital payment", "upi", "insolvency", "tariff"],
  },
  "Environment & Ecology": {
    gs: "GS-3",
    words: ["climate", "cop29", "cop30", "cop31", "unfccc", "emission", "carbon", "net zero", "renewable", "solar",
      "wind energy", "green hydrogen", "biodiversity", "wildlife", "tiger", "elephant", "species", "forest", "wetland",
      "ramsar", "mangrove", "coral", "pollution", "air quality", "aqi", "plastic", "national park", "sanctuary",
      "conservation", "iucn", "endangered", "heatwave", "glacier", "ozone", "ecosystem", "environment"],
  },
  "Science & Technology": {
    gs: "GS-3",
    words: ["isro", "space", "satellite", "gaganyaan", "chandrayaan", "aditya-l1", "nasa", "launch", "rocket",
      "artificial intelligence", "ai", "semiconductor", "quantum", "5g", "6g", "cyber", "drdo", "nuclear",
      "biotechnology", "genome", "gene", "vaccine", "research", "scientists", "discovery", "telescope", "technology",
      "data protection", "deepfake", "supercomputer", "nobel"],
  },
  "Health & Social Issues": {
    gs: "GS-2",
    words: ["health", "disease", "malaria", "tuberculosis", "tb", "cancer", "virus", "outbreak", "nutrition",
      "malnutrition", "anaemia", "maternal", "infant mortality", "education", "nep", "school", "university", "ugc",
      "women", "gender", "child", "tribal", "scheduled caste", "scheduled tribe", "obc", "minority", "poverty",
      "welfare", "scheme", "yojana", "mission", "ayushman", "pension", "disability", "elderly", "migrant", "urbanisation"],
  },
  "Internal Security & Defence": {
    gs: "GS-3",
    words: ["army", "navy", "air force", "iaf", "defence", "military", "missile", "terror", "terrorism", "insurgency",
      "naxal", "maoist", "border", "lac", "loc", "bsf", "crpf", "nia", "afspa", "manipur", "jammu and kashmir",
      "money laundering", "drone", "exercise", "warship", "submarine"],
  },
  "Geography & Disasters": {
    gs: "GS-1",
    words: ["cyclone", "monsoon", "rainfall", "flood", "drought", "earthquake", "landslide", "tsunami", "volcano",
      "imd", "el nino", "la nina", "disaster", "ndma", "ndrf", "river", "himalaya", "ocean", "island", "mineral",
      "critical minerals", "groundwater"],
  },
  "History, Art & Culture": {
    gs: "GS-1",
    words: ["heritage", "unesco", "archaeolog*", "excavation", "temple", "inscription", "ancient", "medieval",
      "freedom fighter", "freedom struggle", "jayanti", "anniversary", "festival", "classical", "dance", "folk",
      "tribal art", "gi tag", "geographical indication", "manuscript", "museum", "culture", "cultural"],
  },
  "Reports & Indices": {
    gs: "Prelims",
    words: ["index", "report", "ranking", "survey", "nfhs", "global hunger", "human development", "world economic outlook",
      "state of", "assessment", "data shows", "study finds"],
  },
};

// Stories matching these are dropped (sports, entertainment, crime, markets etc.).
const EXCLUDE = ["cricket", "ipl", "t20", "odi", "test match", "bollywood", "box office", "film", "movie", "actor",
  "actress", "celebrity", "web series", "ott", "horoscope", "recipe", "murder", "murdered", "stabbed", "rape",
  "molest", "arrested for", "theft", "robbery", "sensex", "nifty", "stock market", "shares of", "ipo", "gold price",
  "silver price", "live updates", "| live", "football", "tennis", "kabaddi", "wedding", "obituary", "dies at",
  "campaign rally", "seat-sharing", "candidate list", "ticket to"];

function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

function parseRss(xml) {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  return items.map((b) => ({
    title: tag(b, "title"),
    link: tag(b, "link"),
    description: tag(b, "description"),
    pubDate: tag(b, "pubDate"),
  }));
}

// YYYY-MM-DD in Indian Standard Time
function istDate(d) {
  return new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

// Whole-word match (plural "s"/"es" allowed). A trailing "*" marks a stem, e.g. "archaeolog*".
const reCache = new Map();
function matches(text, word) {
  if (!reCache.has(word)) {
    const stem = word.endsWith("*");
    const w = word.replace("*", "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    reCache.set(word, new RegExp(`(^|[^a-z])${w}${stem ? "" : "(s|es)?([^a-z]|$)"}`));
  }
  return reCache.get(word).test(text);
}

function classify(item, feed) {
  const text = ` ${item.title} ${item.description} `.toLowerCase();
  if (EXCLUDE.some((w) => text.includes(w))) return null;

  const topics = [];
  let score = 0;
  for (const [name, t] of Object.entries(TOPICS)) {
    const hits = t.words.filter((w) => matches(text, w)).length;
    if (hits) {
      topics.push({ name, gs: t.gs, hits });
      score += hits;
    }
  }
  topics.sort((a, b) => b.hits - a.hits);
  if (feed.curated) score += 1;
  if (score < 2) return null; // too weak a link to the syllabus

  const papers = [...new Set(topics.map((t) => t.gs))];
  return {
    topics: topics.slice(0, 3).map((t) => t.name),
    gs: papers.length ? papers : ["General"],
    score,
    important: score >= 5,
  };
}

async function fetchFeed(feed) {
  const res = await fetch(feed.url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
      "Accept": "application/rss+xml, application/xml, text/xml, */*",
      "Accept-Language": "en-IN,en;q=0.9",
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseRss(await res.text());
}

function loadExisting() {
  try {
    return JSON.parse(fs.readFileSync(JSON_FILE, "utf8"));
  } catch {
    return { updated: null, items: [] };
  }
}

async function update() {
  const db = loadExisting();
  const known = new Set(db.items.map((i) => i.link));
  let added = 0;

  const failed = [];
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  results.forEach((r, idx) => {
    const feed = FEEDS[idx];
    if (r.status === "rejected") {
      console.warn(`  ! ${feed.source} ${feed.section}: ${r.reason.message}`);
      failed.push(`${feed.source} ${feed.section}`);
      return;
    }
    let kept = 0;
    for (const item of r.value) {
      if (!item.title || !item.link || known.has(item.link)) continue;
      const c = classify(item, feed);
      if (!c) continue;
      const when = item.pubDate ? new Date(item.pubDate) : new Date();
      const date = isNaN(when) ? istDate(new Date()) : istDate(when);
      db.items.push({
        id: Buffer.from(item.link).toString("base64url").slice(-24),
        date,
        title: item.title,
        summary: item.description.slice(0, 400),
        link: item.link,
        source: feed.source,
        section: feed.section,
        ...c,
      });
      known.add(item.link);
      kept++;
    }
    added += kept;
    console.log(`  ${feed.source} ${feed.section}: ${r.value.length} fetched, ${kept} new UPSC-relevant`);
  });

  db.items.sort((a, b) => (b.date === a.date ? b.score - a.score : b.date.localeCompare(a.date)));
  db.updated = new Date().toISOString();

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(JSON_FILE, JSON.stringify(db, null, 1));
  // A .js copy lets index.html work when opened directly from disk (no server needed).
  fs.writeFileSync(JS_FILE, `window.CA_DATA = ${JSON.stringify(db)};\n`);
  console.log(`Done: ${added} new stories, ${db.items.length} total in archive.`);
  return { added, failed, db };
}

module.exports = { update };

if (require.main === module) {
  update().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
