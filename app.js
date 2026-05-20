// --- INITIAL DATA (DUMMY DATA) ---
const defaultSteps = [
    {
        id: "step-1",
        title: "Bước 1: Chấp thuận chủ trương đầu tư",
        items: [
            {
                id: "s1-i1",
                name: "Tờ trình đề nghị chấp thuận chủ trương đầu tư",
                legal: "Khoản 1 Điều 31 Luật Đầu tư",
                guidance: "Cơ quan tiếp nhận: Sở Kế hoạch và Đầu tư.<br>Thời gian giải quyết: 35 ngày làm việc kể từ ngày nhận đủ hồ sơ hợp lệ."
            },
            {
                id: "s1-i2",
                name: "Đề xuất dự án đầu tư",
                legal: "Khoản 1 Điều 33 Luật Đầu tư",
                guidance: "Nội dung bao gồm: nhà đầu tư, mục tiêu, quy mô, vốn đầu tư, phương án huy động vốn, địa điểm, thời hạn, tiến độ, đánh giá tác động KT-XH."
            }
        ]
    },
    {
        id: "step-2",
        title: "Bước 2: Cấp Giấy phép thăm dò khoáng sản",
        items: [
            {
                id: "s2-i1",
                name: "Đơn đề nghị cấp Giấy phép thăm dò khoáng sản",
                legal: "Khoản 1a Điều 55 Luật ĐCKS 2025",
                guidance: "Cơ quan tiếp nhận: Sở Tài nguyên và Môi trường (đối với VLXD thông thường).<br>Lưu ý: Mẫu đơn theo quy định tại Nghị định 66."
            },
            {
                id: "s2-i2",
                name: "Đề án thăm dò khoáng sản",
                legal: "Khoản 1b Điều 55 Luật ĐCKS 2025",
                guidance: "Phải được lập bởi tổ chức, cá nhân có đủ điều kiện hành nghề thăm dò khoáng sản."
            },
            {
                id: "s2-i3",
                name: "Bản đồ khu vực thăm dò khoáng sản",
                legal: "Khoản 1c Điều 55 Luật ĐCKS 2025",
                guidance: "Bản đồ địa hình hệ tọa độ VN2000, tỷ lệ 1/5.000 - 1/25.000."
            }
        ]
    },
    {
        id: "step-3",
        title: "Bước 3: Phê duyệt trữ lượng khoáng sản",
        items: [
            {
                id: "s3-i1",
                name: "Báo cáo kết quả thăm dò khoáng sản",
                legal: "Luật ĐCKS 2025",
                guidance: "Nộp kèm theo các biên bản nghiệm thu khối lượng, chất lượng công tác thăm dò."
            },
            {
                id: "s3-i2",
                name: "Quyết định phê duyệt trữ lượng",
                legal: "Hội đồng đánh giá trữ lượng / UBND Tỉnh",
                guidance: "Thời gian thẩm định: Tối đa 60 ngày."
            }
        ]
    }
];

// --- APP STATE ---
let stepsData = [];
let userProgress = {}; // Format: { "s1-i1": true, "s1-i2": false, ... }
let isBypassMode = false;

// --- DOM ELEMENTS ---
const stepsContainer = document.getElementById('steps-container');
const overallProgress = document.getElementById('overall-progress');
const bypassSwitch = document.getElementById('bypass-switch');
const fileUpload = document.getElementById('file-upload');
const btnLoadData = document.getElementById('btn-load-data');
const btnReset = document.getElementById('btn-reset');

// --- INITIALIZATION ---
function init() {
    loadData();
    loadProgress();
    setupEventListeners();
    render();
}

function loadData() {
    const savedData = localStorage.getItem('checklistData');
    if (savedData) {
        try {
            stepsData = JSON.parse(savedData);
        } catch(e) {
            stepsData = defaultSteps;
        }
    } else {
        stepsData = defaultSteps;
    }
}

function loadProgress() {
    const savedProgress = localStorage.getItem('checklistProgress');
    if (savedProgress) {
        try {
            userProgress = JSON.parse(savedProgress);
        } catch(e) {
            userProgress = {};
        }
    } else {
        userProgress = {};
    }
}

function saveProgress() {
    localStorage.setItem('checklistProgress', JSON.stringify(userProgress));
}

function setupEventListeners() {
    bypassSwitch.addEventListener('change', (e) => {
        isBypassMode = e.target.checked;
        render(); // Re-render everything to update lock statuses
    });

    btnLoadData.addEventListener('click', () => {
        fileUpload.click();
    });

    fileUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const newData = JSON.parse(event.target.result);
                if (Array.isArray(newData)) {
                    stepsData = newData;
                    localStorage.setItem('checklistData', JSON.stringify(stepsData));
                    // Reset progress when new data is loaded
                    userProgress = {};
                    saveProgress();
                    render();
                    alert("Đã nạp dữ liệu thành công!");
                } else {
                    alert("Cấu trúc file JSON không hợp lệ. Vui lòng cung cấp một mảng các bước.");
                }
            } catch (err) {
                alert("Lỗi đọc file JSON: " + err.message);
            }
        };
        reader.readAsText(file);
        // Reset file input
        fileUpload.value = '';
    });

    btnReset.addEventListener('click', () => {
        if (confirm("Bạn có chắc chắn muốn đặt lại toàn bộ tiến độ? Dữ liệu đã đánh dấu sẽ bị xóa.")) {
            userProgress = {};
            saveProgress();
            render();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
}

// --- RENDER LOGIC ---
function render() {
    stepsContainer.innerHTML = '';
    let totalItems = 0;
    let completedItems = 0;

    let previousStepCompleted = true; // Initially true so Step 1 is open

    stepsData.forEach((step, index) => {
        // Calculate step progress
        let stepTotal = step.items.length;
        let stepCompleted = 0;
        
        step.items.forEach(item => {
            totalItems++;
            if (userProgress[item.id]) {
                stepCompleted++;
                completedItems++;
            }
        });

        let isStepCompleted = (stepCompleted === stepTotal && stepTotal > 0);
        
        // Determine lock status
        // A step is unlocked if Bypass mode is ON, or if it's the first step, or if previous step is completed.
        let isUnlocked = isBypassMode || index === 0 || previousStepCompleted;
        
        // Determine active status (unlocked but not yet completed)
        let isActive = isUnlocked && !isStepCompleted;

        // Render Step Card
        const card = document.createElement('div');
        card.className = `step-card ${!isUnlocked ? 'locked' : ''} ${isActive ? 'active' : ''} ${isStepCompleted ? 'completed' : ''}`;
        card.id = `step-card-${index}`;

        // Header
        const header = document.createElement('div');
        header.className = 'step-header';
        
        let statusHtml = '';
        if (!isUnlocked) {
            statusHtml = `<span class="step-status locked"><i class="fa-solid fa-lock"></i> Đã khóa</span>`;
        } else if (isStepCompleted) {
            statusHtml = `<span class="step-status completed"><i class="fa-solid fa-circle-check"></i> Hoàn thành</span>`;
        } else {
            statusHtml = `<span class="step-status active"><i class="fa-solid fa-hourglass-half"></i> Đang thực hiện (${stepCompleted}/${stepTotal})</span>`;
        }

        header.innerHTML = `
            <h3 class="step-title">
                ${isStepCompleted ? '<i class="fa-solid fa-check text-success me-2"></i>' : ''}
                ${step.title}
            </h3>
            ${statusHtml}
        `;
        card.appendChild(header);

        // Body (Checklist Items)
        const body = document.createElement('div');
        body.className = 'card-body p-0';

        step.items.forEach((item, itemIndex) => {
            const isChecked = !!userProgress[item.id];
            
            const itemDiv = document.createElement('div');
            itemDiv.className = `checklist-item d-flex ${isChecked ? 'checked' : ''}`;
            
            itemDiv.innerHTML = `
                <div class="form-check d-flex gap-3 w-100">
                    <input class="form-check-input checklist-checkbox" type="checkbox" id="${item.id}" ${isChecked ? 'checked' : ''} ${!isUnlocked ? 'disabled' : ''}>
                    <div class="flex-grow-1">
                        <label class="form-check-label w-100" for="${item.id}" style="cursor: pointer;">
                            <div class="item-title">${item.name}</div>
                            <div class="item-legal"><i class="fa-solid fa-scale-balanced me-1"></i> ${item.legal}</div>
                        </label>
                        ${item.guidance ? `
                            <button class="btn btn-outline-secondary btn-guidance mt-1" type="button" data-bs-toggle="collapse" data-bs-target="#guidance-${item.id}" aria-expanded="false" aria-controls="guidance-${item.id}">
                                <i class="fa-solid fa-circle-info"></i> Xem hướng dẫn
                            </button>
                            <div class="collapse" id="guidance-${item.id}">
                                <div class="guidance-content">
                                    ${item.guidance}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            
            // Event listener for checkbox
            const checkbox = itemDiv.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', (e) => {
                userProgress[item.id] = e.target.checked;
                saveProgress();
                
                // Check if this step just became completed
                const newStepCompleted = step.items.filter(i => userProgress[i.id]).length === stepTotal;
                if (newStepCompleted && !isStepCompleted && !isBypassMode) {
                    // Step just completed! Re-render and scroll to next step.
                    render();
                    const nextStepCard = document.getElementById(`step-card-${index + 1}`);
                    if (nextStepCard) {
                        setTimeout(() => {
                            nextStepCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 100);
                    }
                } else {
                    render(); // Re-render to update UI (progress, active state)
                }
            });

            body.appendChild(itemDiv);
        });
        
        card.appendChild(body);

        // Lock Overlay
        const overlay = document.createElement('div');
        overlay.className = 'lock-overlay';
        overlay.innerHTML = `<div class="lock-icon"><i class="fa-solid fa-lock"></i></div>`;
        card.appendChild(overlay);

        stepsContainer.appendChild(card);

        // Update previousStepCompleted for the next iteration
        previousStepCompleted = isStepCompleted;
    });

    // Update overall progress bar
    const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    overallProgress.style.width = `${progressPercent}%`;
    overallProgress.setAttribute('aria-valuenow', progressPercent);
    overallProgress.textContent = `${progressPercent}%`;
}

// Start app
document.addEventListener('DOMContentLoaded', init);
