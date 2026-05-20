const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the else block for AI button and replace it
const oldBlock = `            } else {
                aiArea.innerHTML = \`
                    <span class="text-muted" style="font-size:0.9rem;"><i class="fa-solid fa-wand-magic-sparkles text-warning me-1"></i> Trợ lý AI có thể tự động lập checklist dựa trên dữ liệu luật đã nạp.</span>
                    <button class="btn btn-outline-primary btn-sm btn-ai-extract" data-step-id="\${step.step_id}">
                        <i class="fa-solid fa-robot"></i> AI Trích xuất hồ sơ &amp; Hướng dẫn
                    </button>
                \`;
            }`;

const newBlock = `            } else {
                const hasChecklist = step.checklist.length > 0;
                if (hasChecklist) {
                    aiArea.innerHTML = \`
                        <span class="text-muted" style="font-size:0.85rem;"><i class="fa-solid fa-circle-check text-success me-1"></i> Đã có checklist (\${step.checklist.length} mục). Chỉnh sửa thủ công hoặc tạo lại bằng AI.</span>
                        <button class="btn btn-outline-secondary btn-sm btn-ai-extract" data-step-id="\${step.step_id}" title="Cảnh báo: Sẽ xóa toàn bộ checklist hiện tại và tạo mới bằng AI">
                            <i class="fa-solid fa-rotate-right"></i> Tạo lại bằng AI
                        </button>
                    \`;
                } else {
                    aiArea.innerHTML = \`
                        <span class="text-muted" style="font-size:0.9rem;"><i class="fa-solid fa-wand-magic-sparkles text-warning me-1"></i> Trợ lý AI có thể tự động lập checklist dựa trên dữ liệu luật đã nạp.</span>
                        <button class="btn btn-outline-primary btn-sm btn-ai-extract" data-step-id="\${step.step_id}">
                            <i class="fa-solid fa-robot"></i> AI Trích xuất hồ sơ &amp; Hướng dẫn
                        </button>
                    \`;
                }
            }`;

if (content.includes(oldBlock)) {
    content = content.replace(oldBlock, newBlock);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('SUCCESS: AI button logic updated.');
} else {
    // Try finding it with CRLF
    const oldBlockCRLF = oldBlock.replace(/\n/g, '\r\n');
    if (content.includes(oldBlockCRLF)) {
        content = content.replace(oldBlockCRLF, newBlock);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('SUCCESS (CRLF): AI button logic updated.');
    } else {
        console.log('ERROR: Could not find target block. Printing surrounding area for debug:');
        const idx = content.indexOf('btn-ai-extract');
        console.log(content.substring(idx - 300, idx + 300));
    }
}
