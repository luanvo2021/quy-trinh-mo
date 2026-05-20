import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find exact location
idx = content.find('            } else {\n                aiArea.innerHTML')
print('else block at:', idx)
if idx >= 0:
    print(repr(content[idx:idx+600]))
