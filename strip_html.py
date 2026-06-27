import os
import re

directory = '/Users/sheriffy/Downloads/Reclaiming'
exclude = ['index.html', 'latest.html', 'PRD']

for filename in os.listdir(directory):
    if filename.endswith('.html') and filename not in exclude:
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r') as file:
            content = file.read()
        
        # Replace href="filename.html" with href="filename"
        content = re.sub(r'href="([^"]+)\.html"', r'href="\1"', content)
        
        # Replace window.location.href = 'filename.html' with 'filename'
        content = re.sub(r"window\.location\.href\s*=\s*'([^']+)\.html'", r"window.location.href = '\1'", content)
        
        # Replace window.location.href='filename.html'
        content = re.sub(r'window\.location\.href="([^"]+)\.html"', r'window.location.href="\1"', content)
        
        with open(filepath, 'w') as file:
            file.write(content)

print("Successfully stripped .html from internal links.")
