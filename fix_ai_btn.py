import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = '            } else {\n                aiArea.innerHTML = `\n                    <span class="text-muted" style="font-size:0.9rem;"><i class="fa-solid fa-wand-magic-sparkles text-warning me-1"></i> Tr\u1ee3 l\u00fd AI c\u00f3 th\u1ec3 t\u1ef1 \u0111\u1ed9ng l\u1eadp checklist d\u1ef1a tr\u00ean d\u1eef li\u1ec7u lu\u1eadt \u0111\u00e3 n\u1ea1p.</span>\n                    <button class="btn btn-outline-primary btn-sm btn-ai-extract" data-step-id="${step.step_id}">\n                        <i class="fa-solid fa-robot"></i> AI Tr\u00edch xu\u1ea5t h\u1ed3 s\u01a1 & H\u01b0\u1edbng d\u1eabn\n                    </button>\n                `;\n            }'

new = '''            } else {
                const hasChecklist = step.checklist.length > 0;
                if (hasChecklist) {
                    aiArea.innerHTML = `
                        <span class="text-muted" style="font-size:0.85rem;"><i class="fa-solid fa-circle-check text-success me-1"></i> \u0110\u00e3 c\u00f3 checklist (${step.checklist.length} m\u1ee5c). Ch\u1ec9nh s\u1eeda th\u1ee7 c\u00f4ng ho\u1eb7c t\u1ea1o l\u1ea1i b\u1eb1ng AI.</span>
                        <button class="btn btn-outline-secondary btn-sm btn-ai-extract" data-step-id="${step.step_id}" title="C\u1ea3nh b\u00e1o: S\u1ebd x\u00f3a to\u00e0n b\u1ed9 checklist hi\u1ec7n t\u1ea1i v\u00e0 t\u1ea1o m\u1edbi b\u1eb1ng AI">
                            <i class="fa-solid fa-rotate-right"></i> T\u1ea1o l\u1ea1i b\u1eb1ng AI
                        </button>
                    `;
                } else {
                    aiArea.innerHTML = `
                        <span class="text-muted" style="font-size:0.9rem;"><i class="fa-solid fa-wand-magic-sparkles text-warning me-1"></i> Tr\u1ee3 l\u00fd AI c\u00f3 th\u1ec3 t\u1ef1 \u0111\u1ed9ng l\u1eadp checklist d\u1ef1a tr\u00ean d\u1eef li\u1ec7u lu\u1eadt \u0111\u00e3 n\u1ea1p.</span>
                        <button class="btn btn-outline-primary btn-sm btn-ai-extract" data-step-id="${step.step_id}">
                            <i class="fa-solid fa-robot"></i> AI Tr\u00edch xu\u1ea5t h\u1ed3 s\u01a1 &amp; H\u01b0\u1edbng d\u1eabn
                        </button>
                    `;
                }
            }'''

if old in content:
    content = content.replace(old, new, 1)
    with open('app.js', 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)
    print('SUCCESS: AI button logic patched.')
else:
    print('ERROR: Block not found.')
    idx = content.find('} else {\n                aiArea')
    print('idx:', idx)
