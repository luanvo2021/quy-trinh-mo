// --- INITIAL DATA (DUMMY DATA) ---
const defaultSteps = [
    {
        "step_id": 1,
        "step_name": "Bước 1: Chấp thuận chủ trương đầu tư mỏ đặc thù",
        "checklist": [
            {
                "doc_name": "Tờ trình đề nghị chấp thuận chủ trương đầu tư",
                "responsible": "Thuận Phong",
                "agency": "UBND Tỉnh",
                "legal": "Khoản 1a Điều 55 Luật Địa chất & Khoáng sản 2025",
                "guide": "Nộp tại Bộ phận một cửa của UBND tỉnh. Thời gian xử lý: 25 ngày làm việc."
            },
            {
                "doc_name": "Hồ sơ năng lực tài chính và kinh nghiệm khai thác",
                "responsible": "Chủ đầu tư",
                "agency": "Sở Tài chính",
                "legal": "Luật Đầu tư công và Nghị định hướng dẫn liên quan",
                "guide": "Cần chuẩn bị báo cáo tài chính 2 năm gần nhất có kiểm toán."
            }
        ]
    },
    {
        "step_id": 2,
        "step_name": "Bước 2: Cấp Giấy phép thăm dò khoáng sản",
        "checklist": [
            {
                "doc_name": "Đơn đề nghị cấp Giấy phép thăm dò khoáng sản",
                "responsible": "Thuận Phong",
                "agency": "Sở Nông nghiệp và Môi trường",
                "legal": "Khoản 1a Điều 55 Luật ĐCKS 2025",
                "guide": "Sử dụng Mẫu số 01 kèm theo Nghị định 66."
            },
            {
                "doc_name": "Đề án thăm dò khoáng sản",
                "responsible": "Phối hợp giữa các bên",
                "agency": "Sở Nông nghiệp và Môi trường",
                "legal": "Khoản 1b Điều 55 Luật ĐCKS 2025",
                "guide": "Công ty tư vấn thiết kế lập, Chủ đầu tư phê duyệt trước khi nộp."
            },
            {
                "doc_name": "Bản đồ khu vực thăm dò khoáng sản",
                "responsible": "Công ty",
                "agency": "Sở Nông nghiệp và Môi trường",
                "legal": "Khoản 1c Điều 55 Luật ĐCKS 2025",
                "guide": "Tỷ lệ bản đồ 1/5.000, hệ tọa độ VN2000."
            }
        ]
    }
];

// --- APP STATE ---
let stepsData = [];
let userProgress = {}; // Format: { "s1-i0": true, "s1-i1": false, ... }
let isBypassMode = false;
let filterResponsible = "ALL";
let filterAgency = "ALL";

// --- DOM ELEMENTS ---
const stepsContainer = document.getElementById('steps-container');
const overallProgress = document.getElementById('overall-progress');
const bypassSwitch = document.getElementById('bypass-switch');
const fileUpload = document.getElementById('file-upload');
const btnLoadData = document.getElementById('btn-load-data');
const btnReset = document.getElementById('btn-reset');
const selFilterResponsible = document.getElementById('filter-responsible');
const selFilterAgency = document.getElementById('filter-agency');

// --- INITIALIZATION ---
function init() {
    loadData();
    loadProgress();
    populateFilters();
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

function populateFilters() {
    const agencies = new Set();
    const responsibles = new Set();
    
    stepsData.forEach(step => {
        step.checklist.forEach(item => {
            if (item.agency) agencies.add(item.agency.trim());
            if (item.responsible) responsibles.add(item.responsible.trim());
        });
    });
    
    // Populate Agency Filter
    selFilterAgency.innerHTML = '<option value="ALL">-- Tất cả cơ quan tiếp nhận --</option>';
    Array.from(agencies).sort().forEach(agency => {
        const option = document.createElement('option');
        option.value = agency;
        option.textContent = agency;
        selFilterAgency.appendChild(option);
    });
    
    // Populate Responsible Filter
    selFilterResponsible.innerHTML = '<option value="ALL">-- Tất cả bên chịu trách nhiệm --</option>';
    Array.from(responsibles).sort().forEach(resp => {
        const option = document.createElement('option');
        option.value = resp;
        option.textContent = resp;
        selFilterResponsible.appendChild(option);
    });
}

function setupEventListeners() {
    bypassSwitch.addEventListener('change', (e) => {
        isBypassMode = e.target.checked;
        render();
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
                    userProgress = {};
                    saveProgress();
                    populateFilters();
                    // Reset filters
                    filterResponsible = "ALL";
                    filterAgency = "ALL";
                    selFilterResponsible.value = "ALL";
                    selFilterAgency.value = "ALL";
                    
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

    selFilterResponsible.addEventListener('change', (e) => {
        filterResponsible = e.target.value;
        render();
    });

    selFilterAgency.addEventListener('change', (e) => {
        filterAgency = e.target.value;
        render();
    });
}

// Helper to get badge class for responsible party
function getResponsibleBadgeClass(role) {
    if (!role) return 'bg-secondary text-white';
    const lowerRole = role.toLowerCase();
    if (lowerRole.includes('công ty') || lowerRole.includes('thuận phong')) return 'badge-company';
    if (lowerRole.includes('chủ đầu tư') || lowerRole.includes('đối tác')) return 'badge-investor';
    if (lowerRole.includes('phối hợp')) return 'badge-coord';
    
    // Dynamic fallback for unknown roles
    const colors = ['badge-company', 'badge-investor', 'badge-coord', 'bg-info text-dark', 'bg-dark text-white'];
    let hash = 0;
    for (let i = 0; i < role.length; i++) hash = role.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

// --- RENDER LOGIC ---
function render() {
    stepsContainer.innerHTML = '';
    
    // Variables for overall progress (ignores filters)
    let totalItemsSystem = 0;
    let completedItemsSystem = 0;

    let previousStepCompleted = true; // For unlock mechanism

    stepsData.forEach((step, stepIndex) => {
        // Calculate step progress (ignores filters for logic lock/unlock)
        let stepTotalSystem = step.checklist.length;
        let stepCompletedSystem = 0;
        
        let visibleItemsInStep = 0; // To hide step if all items are filtered out

        step.checklist.forEach((item, itemIndex) => {
            const itemId = `s${step.step_id}-i${itemIndex}`;
            totalItemsSystem++;
            if (userProgress[itemId]) {
                stepCompletedSystem++;
                completedItemsSystem++;
            }
            
            // Check visibility for filter
            const matchResp = filterResponsible === "ALL" || (item.responsible && item.responsible === filterResponsible);
            const matchAgency = filterAgency === "ALL" || (item.agency && item.agency === filterAgency);
            if (matchResp && matchAgency) {
                visibleItemsInStep++;
            }
        });

        let isStepCompleted = (stepCompletedSystem === stepTotalSystem && stepTotalSystem > 0);
        
        // Determine lock status: unlocked if Bypass, or first step, or previous step completed
        let isUnlocked = isBypassMode || stepIndex === 0 || previousStepCompleted;
        
        // Determine active status
        let isActive = isUnlocked && !isStepCompleted;

        // Skip rendering this step if filters hid all its items, UNLESS it's active/completed and we want to show empty state (better to just hide it for cleaner UI)
        if (visibleItemsInStep === 0 && filterResponsible !== "ALL" || (visibleItemsInStep === 0 && filterAgency !== "ALL")) {
            // Wait, if it's completely filtered out, we might want to hide the step card entirely.
            // But we must update previousStepCompleted for the NEXT step regardless of filter visibility!
            previousStepCompleted = isStepCompleted;
            return; 
        }

        // Render Step Card
        const card = document.createElement('div');
        card.className = `step-card ${!isUnlocked ? 'locked' : ''} ${isActive ? 'active' : ''} ${isStepCompleted ? 'completed' : ''}`;
        card.id = `step-card-${step.step_id}`;

        // Header
        const header = document.createElement('div');
        header.className = 'step-header';
        
        let statusHtml = '';
        if (!isUnlocked) {
            statusHtml = `<span class="step-status locked"><i class="fa-solid fa-lock"></i> Đã khóa</span>`;
        } else if (isStepCompleted) {
            statusHtml = `<span class="step-status completed"><i class="fa-solid fa-circle-check"></i> Hoàn thành</span>`;
        } else {
            statusHtml = `<span class="step-status active"><i class="fa-solid fa-hourglass-half"></i> Đang thực hiện (${stepCompletedSystem}/${stepTotalSystem})</span>`;
        }

        header.innerHTML = `
            <h3 class="step-title">
                ${isStepCompleted ? '<i class="fa-solid fa-check text-success me-2"></i>' : ''}
                ${step.step_name}
            </h3>
            ${statusHtml}
        `;
        card.appendChild(header);

        // Body (Checklist Items)
        const body = document.createElement('div');
        body.className = 'card-body p-0';

        step.checklist.forEach((item, itemIndex) => {
            const itemId = `s${step.step_id}-i${itemIndex}`;
            const isChecked = !!userProgress[itemId];
            
            // Apply Filters
            const matchResp = filterResponsible === "ALL" || (item.responsible && item.responsible === filterResponsible);
            const matchAgency = filterAgency === "ALL" || (item.agency && item.agency === filterAgency);
            
            if (!matchResp || !matchAgency) {
                return; // Skip rendering this item
            }
            
            const itemDiv = document.createElement('div');
            itemDiv.className = `checklist-item d-flex ${isChecked ? 'checked' : ''}`;
            
            const respBadgeClass = getResponsibleBadgeClass(item.responsible);
            
            itemDiv.innerHTML = `
                <div class="form-check d-flex gap-3 w-100">
                    <input class="form-check-input checklist-checkbox" type="checkbox" id="${itemId}" ${isChecked ? 'checked' : ''} ${!isUnlocked ? 'disabled' : ''}>
                    <div class="flex-grow-1">
                        <label class="form-check-label w-100" for="${itemId}" style="cursor: pointer;">
                            <div class="item-title">${item.doc_name}</div>
                            <div class="item-meta">
                                ${item.responsible ? `<span class="badge-custom ${respBadgeClass}"><i class="fa-solid fa-user-tie"></i> Chủ trì: ${item.responsible}</span>` : ''}
                                ${item.agency ? `<span class="badge-custom badge-agency"><i class="fa-solid fa-building-columns"></i> Nộp tại: ${item.agency}</span>` : ''}
                            </div>
                            <div class="item-legal"><i class="fa-solid fa-scale-balanced text-secondary"></i> Căn cứ pháp lý: ${item.legal}</div>
                        </label>
                        ${item.guide ? `
                            <button class="btn btn-outline-secondary btn-guidance mt-1" type="button" data-bs-toggle="collapse" data-bs-target="#guidance-${itemId}" aria-expanded="false" aria-controls="guidance-${itemId}">
                                <i class="fa-solid fa-circle-info"></i> Xem hướng dẫn / Lưu ý
                            </button>
                            <div class="collapse" id="guidance-${itemId}">
                                <div class="guidance-content">
                                    ${item.guide}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            
            // Event listener for checkbox
            const checkbox = itemDiv.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', (e) => {
                userProgress[itemId] = e.target.checked;
                saveProgress();
                
                // Recalculate step completion for auto-scroll logic
                const currentStepCompletedCount = step.checklist.filter((_, idx) => userProgress[`s${step.step_id}-i${idx}`]).length;
                const newStepCompleted = currentStepCompletedCount === stepTotalSystem;
                
                if (newStepCompleted && !isStepCompleted && !isBypassMode) {
                    render();
                    // Try to scroll to next available step
                    const nextStepIndex = stepIndex + 1;
                    if (nextStepIndex < stepsData.length) {
                        const nextStepDataId = stepsData[nextStepIndex].step_id;
                        setTimeout(() => {
                            const nextStepCard = document.getElementById(`step-card-${nextStepDataId}`);
                            if (nextStepCard) {
                                nextStepCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        }, 100);
                    }
                } else {
                    render();
                }
            });

            body.appendChild(itemDiv);
        });
        
        // If a step is empty because of filters, we already handled returning early. 
        // But if we got here and body has no children (e.g. edge case), don't append card.
        if (body.children.length > 0) {
            card.appendChild(body);
            
            // Lock Overlay
            const overlay = document.createElement('div');
            overlay.className = 'lock-overlay';
            overlay.innerHTML = `<div class="lock-icon"><i class="fa-solid fa-lock"></i></div>`;
            card.appendChild(overlay);

            stepsContainer.appendChild(card);
        }

        // Update previousStepCompleted for the next iteration (MUST be based on system total, not filtered visible items)
        previousStepCompleted = isStepCompleted;
    });
    
    // Handle case where all steps are filtered out
    if (stepsContainer.children.length === 0) {
         stepsContainer.innerHTML = `<div class="text-center p-5 text-muted"><i class="fa-solid fa-magnifying-glass fs-2 mb-3"></i><br>Không có hồ sơ nào khớp với bộ lọc hiện tại.</div>`;
    }

    // Update overall progress bar (based on TOTAL SYSTEM items, unaffected by filters)
    const progressPercent = totalItemsSystem > 0 ? Math.round((completedItemsSystem / totalItemsSystem) * 100) : 0;
    overallProgress.style.width = `${progressPercent}%`;
    overallProgress.setAttribute('aria-valuenow', progressPercent);
    overallProgress.textContent = `${progressPercent}%`;
}

// Start app
document.addEventListener('DOMContentLoaded', init);
