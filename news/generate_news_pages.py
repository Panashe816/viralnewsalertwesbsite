import os
import re
import json
import html
from datetime import datetime, timezone
import requests

SITE = "https://viralnewsalert.com"
API_BASE = "https://viral-news-backend-3.onrender.com"

OUT_DIR = "news"
NEWS_SITEMAP = "news-sitemap.xml"

# Start with 300 so your first commit isn't huge.
MAX_ARTICLES = 300
API_LIMIT = 500  # backend limit for /articles/?limit=

def slugify(text: str) -> str:
    text = (text or "").lower()
    text = text.replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-{2,}", "-", text).strip("-")
    return text or "story"

def safe_iso(dt_str: str) -> str:
    if not dt_str:
        return datetime.now(timezone.utc).isoformat()
    try:
        d = datetime.fromisoformat(str(dt_str).replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return d.astimezone(timezone.utc).isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()

def first_img_src(html_text: str) -> str:
    if not html_text:
        return ""
    m = re.search(r'<img\b[^>]*\bsrc\s*=\s*["\']([^"\']+)["\']', str(html_text), re.I)
    return (m.group(1).strip() if m else "")

def remove_first_img_tag(html_text: str) -> str:
    if not html_text:
        return ""
    return re.sub(r"<img\b[^>]*>", "", str(html_text), count=1, flags=re.I)

def normalize_content(raw: str) -> str:
    if not raw:
        return ""
    s = str(raw)

    # If it's already HTML paragraphs, keep it.
    if re.search(r"<p\b", s, re.I):
        return s

    # Convert plaintext to <p> blocks.
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    s = re.sub(r"\n\s*---\s*\n", "\n<hr>\n", s)
    parts = re.split(r"\n\s*\n+", s)

    out = []
    for block in parts:
        block = block.strip()
        if not block:
            continue
        if block == "<hr>":
            out.append("<hr>")
        else:
            out.append("<p>" + html.escape(block) + "</p>")
    return "".join(out)

def strip_html_tags(s: str) -> str:
    return re.sub(r"<[^>]*>", " ", str(s or "")).strip()

def fetch_articles() -> list:
    # Pull newest articles
    url = f"{API_BASE}/articles/?limit={API_LIMIT}"
    r = requests.get(url, timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"Failed to fetch: HTTP {r.status_code} {r.text[:200]}")
    data = r.json()
    if not isinstance(data, list):
        raise RuntimeError("Bad JSON: expected list")

    # Sort newest first
    def key(a):
        return a.get("published_at") or a.get("created_at") or ""
    data.sort(key=key, reverse=True)

    return data[:MAX_ARTICLES]

def build_article_page(a: dict):
    art_id = a.get("id")
    title = (a.get("title") or "").strip()
    category = (a.get("category") or "general").strip()
    content = a.get("content") or ""
    summary = a.get("summary") or ""
    img_url = (a.get("image_url") or "").strip()

    cat_slug = slugify(category)
    title_slug = slugify(title)
    filename = f"{title_slug}-{art_id}.html"

    rel_dir = os.path.join(OUT_DIR, cat_slug)
    rel_path = os.path.join(rel_dir, filename)

    url = f"{SITE}/{OUT_DIR}/{cat_slug}/{filename}"

    published_iso = safe_iso(a.get("published_at") or a.get("created_at") or "")
    lastmod = published_iso.split("T")[0]

    # Hero image: first <img> in content OR image_url
    hero = ""
    if "<img" in str(content).lower():
        hero = first_img_src(content)
        content = remove_first_img_tag(content)
    if not hero and img_url:
        hero = img_url

    pretty = normalize_content(content)

    # Description
    desc = summary.strip() or strip_html_tags(pretty)
    desc = re.sub(r"\s+", " ", desc).strip()[:180]
    og_img = hero or f"{SITE}/android-chrome-512x512.png"

    jsonld = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "mainEntityOfPage": {"@type": "WebPage", "@id": url},
        "headline": title[:110],
        "datePublished": published_iso,
        "dateModified": published_iso,
        "author": {"@type": "Organization", "name": "Viral News"},
        "publisher": {
            "@type": "Organization",
            "name": "Viral News",
            "logo": {"@type": "ImageObject", "url": f"{SITE}/favicon-32x32.png"}
        },
        "image": [og_img]
    }

    page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{html.escape(title)} • Viral News</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="{html.escape(desc)}">

<link rel="canonical" href="{url}">

<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{html.escape(og_img)}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{html.escape(title)}">
<meta name="twitter:description" content="{html.escape(desc)}">
<meta name="twitter:image" content="{html.escape(og_img)}">

<script type="application/ld+json">{json.dumps(jsonld)}</script>

<style>
  body{{font-family:Arial,sans-serif;background:#0a1d3f;color:#fff;margin:0;padding:0}}
  header{{background:#081737;position:sticky;top:0;z-index:1000;padding:15px 20px;display:flex;justify-content:space-between;align-items:center}}
  header a{{color:#ffcc00;text-decoration:none;font-weight:800}}
  .container{{max-width:900px;margin:18px auto;padding:0 20px 40px}}
  .card{{background:#0f264f;border-radius:12px;padding:16px;border:1px solid rgba(255,255,255,.06)}}
  h1{{font-size:26px;line-height:1.25;margin:0 0 10px}}
  .meta{{color:#cfd8ea;font-size:12px;margin-bottom:10px}}
  .hero{{width:100%;border-radius:12px;margin:10px 0 14px;display:block}}
  .content{{line-height:1.7;font-size:15px}}
  .content img{{max-width:100%;border-radius:12px;margin:12px 0;display:block}}
  .content hr{{border:none;border-top:1px solid rgba(255,255,255,.18);margin:14px 0;opacity:.8}}
</style>
</head>
<body>

<header>
  <div style="font-weight:900;letter-spacing:.7px">VIRAL NEWS</div>
  <a href="/">← Home</a>
</header>

<div class="container">
  <div class="card">
    <h1>{html.escape(title)}</h1>
    <div class="meta">{html.escape(category)} • {html.escape(lastmod)}</div>
    {"<img class='hero' decoding='async' src='" + html.escape(hero) + "' alt='" + html.escape(title) + "'>" if hero else ""}
    <div class="content">{pretty}</div>
  </div>
</div>

</body>
</html>
"""
    return rel_path, url, lastmod, page

def write_file(path: str, content: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def build_news_sitemap(entries):
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, lastmod in entries:
        lines.append("  <url>")
        lines.append(f"    <loc>{loc}</loc>")
        lines.append(f"    <lastmod>{lastmod}</lastmod>")
        lines.append("    <changefreq>hourly</changefreq>")
        lines.append("    <priority>0.7</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")
    return "\n".join(lines)

def main():
    articles = fetch_articles()

    sitemap_entries = []
    generated = 0

    for a in articles:
        if not a.get("id") or not a.get("title") or not a.get("content"):
            continue

        rel_path, url, lastmod, page_html = build_article_page(a)
        write_file(rel_path, page_html)
        sitemap_entries.append((url, lastmod))
        generated += 1

    # write news sitemap to repo root
    with open(NEWS_SITEMAP, "w", encoding="utf-8") as f:
        f.write(build_news_sitemap(sitemap_entries))

    print(f"✅ Generated {generated} pages into /{OUT_DIR}/")
    print(f"✅ Wrote {NEWS_SITEMAP} with {len(sitemap_entries)} URLs")

if __name__ == "__main__":
    main()

