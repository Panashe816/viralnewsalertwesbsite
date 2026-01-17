import os
from datetime import datetime

BASE_URL = "https://viralnewsalert.com"

# Folders to include
INCLUDE_DIRS = [
    ".",            # root (index.html, about-us.html, etc.)
    "category",     # category/*.html
]

# Files to exclude
EXCLUDE_FILES = {
    ".venv",
    "CNAME",
}

def is_html_file(path: str) -> bool:
    return path.lower().endswith(".html") or path.lower().endswith(".htm")

def build_urls():
    urls = []

    # Always include homepage
    urls.append(("/", datetime.utcnow().date().isoformat()))

    for d in INCLUDE_DIRS:
        if not os.path.isdir(d):
            continue

        for root, dirs, files in os.walk(d):
            # Skip hidden folders and excluded folders
            dirs[:] = [x for x in dirs if not x.startswith(".") and x not in EXCLUDE_FILES]

            for f in files:
                if f in EXCLUDE_FILES:
                    continue

                full_path = os.path.join(root, f)

                # Only include html files + sitemap.xml itself
                if f == "index.html":
                    continue  # already covered as "/"

                if is_html_file(f):
                    # Convert filesystem path to URL path
                    url_path = full_path.replace("\\", "/")
                    if url_path.startswith("./"):
                        url_path = url_path[2:]
                    if url_path.startswith("."):
                        continue

                    urls.append(("/" + url_path, datetime.utcnow().date().isoformat()))

    # De-duplicate while preserving order
    seen = set()
    deduped = []
    for p, lm in urls:
        if p not in seen:
            seen.add(p)
            deduped.append((p, lm))
    return deduped

def write_sitemap(urls):
    lines = []
    lines.append('<?xml version="1.0" encoding="UTF-8"?>')
    lines.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')

    for path, lastmod in urls:
        loc = f"{BASE_URL}{path}"
        lines.append("  <url>")
        lines.append(f"    <loc>{loc}</loc>")
        lines.append(f"    <lastmod>{lastmod}</lastmod>")
        lines.append("    <changefreq>hourly</changefreq>")
        lines.append("    <priority>0.8</priority>")
        lines.append("  </url>")

    lines.append("</urlset>")
    content = "\n".join(lines) + "\n"

    with open("sitemap.xml", "w", encoding="utf-8") as f:
        f.write(content)

if __name__ == "__main__":
    urls = build_urls()
    write_sitemap(urls)
    print(f"✅ sitemap.xml generated with {len(urls)} URLs")
