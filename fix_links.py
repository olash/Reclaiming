import os
import re

html_files = [f for f in os.listdir('.') if f.endswith('.html')]

# List of pages that are often linked without .html
pages = [
    'dashboard', 'vault', 'wizard', 'auth', 'admin-queue', 
    'admin-cms', 'dispute', 'recovery-detail', 'discovery-wizard'
]

# We should also replace 'wizard' with 'discovery-wizard.html' assuming 'wizard' actually meant 'discovery-wizard' 
# or just 'wizard.html' since 'wizard.html' does exist. Let's stick to appending .html.

for file in html_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    for page in pages:
        # Match href="page" and replace with href="page.html"
        # Also handle window.location.href = 'page'
        content = re.sub(r'href="' + page + r'"', f'href="{page}.html"', content)
        content = re.sub(r"href='" + page + r"'", f"href='{page}.html'", content)
        content = re.sub(r"window\.location\.href\s*=\s*'" + page + r"'", f"window.location.href = '{page}.html'", content)
        content = re.sub(r'window\.location\.href\s*=\s*"' + page + r'"', f'window.location.href = "{page}.html"', content)
    
    if content != original:
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed links in {file}")
