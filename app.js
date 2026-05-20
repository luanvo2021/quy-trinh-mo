import { GoogleGenerativeAI } from '@google/generative-ai';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, update } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCX2gUFhAaVeJOliOF221a_4C4rJSPprvA",
  authDomain: "process-app-c3596.firebaseapp.com",
  databaseURL: "https://process-app-c3596-default-rtdb.firebaseio.com",
  projectId: "process-app-c3596",
  storageBucket: "process-app-c3596.firebasestorage.app",
  messagingSenderId: "8263139055",
  appId: "1:8263139055:web:7f86a36766d69b4ce9a51a",
  measurementId: "G-1DCHTP3TKB"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Firebase References
const stepsDataRef = ref(db, 'globalProject/stepsData');
const userProgressRef = ref(db, 'globalProject/userProgress');
const lawDatabaseRef = ref(db, 'globalProject/lawDatabase');

// --- INITIAL DATA (DUMMY DATA) ---
const defaultSteps = [
    {
        "step_id": 1,
        "step_name": "Bước 1: Chấp thuận chủ trương đầu tư mỏ đặc thù",
        "step_description": "Xin ý kiến chấp thuận chủ trương đầu tư từ UBND Tỉnh cho dự án khai thác khoáng sản.",
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
        "step_description": "Xin cấp giấy phép thăm dò để đánh giá trữ lượng khoáng sản tại khu vực dự án.",
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
            }
        ]
    },
    {
        "step_id": 3,
        "step_name": "Bước 3: Lập ĐTM và đánh giá tác động lòng bờ sông",
        "step_description": "Thực hiện đánh giá tác động môi trường (ĐTM) và các báo cáo đánh giá tác động đến lòng, bờ, bãi sông theo quy định pháp luật.",
        "checklist": [] // Empty checklist to test AI feature
    }
];

// --- APP STATE ---
let stepsData = [];
let userProgress = {}; // Format: { "s1-i0": true, "s1-i1": false, ... }
let isBypassMode = false;
let filterResponsible = "ALL";
let filterAgency = "ALL";

// AI State
let LAW_DATABASE = "";
let uploadedLawFilesCount = 0;
let geminiApiKey = ""; // Nhập API Key qua giao diện web
let geminiModelName = "gemini-2.5-flash";
let isLoadingAI = null; // Track which step is currently loading

// --- DOM ELEMENTS ---
const stepsContainer = document.getElementById('steps-container');
const overallProgress = document.getElementById('overall-progress');
const bypassSwitch = document.getElementById('bypass-switch');
const fileUpload = document.getElementById('file-upload');
const btnLoadData = document.getElementById('btn-load-data');
const btnReset = document.getElementById('btn-reset');
const selFilterResponsible = document.getElementById('filter-responsible');
const selFilterAgency = document.getElementById('filter-agency');

// AI DOM Elements
const inputApiKey = document.getElementById('gemini-api-key');
const selGeminiModel = document.getElementById('gemini-model-select');
const btnSaveKey = document.getElementById('btn-save-key');
const btnUploadLaw = document.getElementById('btn-upload-law');
const btnClearLaw = document.getElementById('btn-clear-law');
const fileUploadLaw = document.getElementById('file-upload-law');
const lawStatus = document.getElementById('law-status');
const cloudStatus = document.getElementById('cloud-status');

// --- INITIALIZATION ---
function init() {
    loadAiConfig();
    setupEventListeners();
    initFirebaseListeners();
}

let isDataLoaded = false;
let isProgressLoaded = false;

function initFirebaseListeners() {
    const connectedRef = ref(db, ".info/connected");
    onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
            cloudStatus.className = "badge bg-success text-white";
            cloudStatus.innerHTML = `<i class="fa-solid fa-cloud"></i> Đã đồng bộ Cloud`;
        } else {
            cloudStatus.className = "badge bg-warning text-dark";
            cloudStatus.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Mất kết nối`;
        }
    });

    onValue(stepsDataRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            stepsData = data;
        } else {
            stepsData = defaultSteps;
            set(stepsDataRef, stepsData);
        }
        isDataLoaded = true;
        populateFilters();
        checkAndRender();
    });

    onValue(userProgressRef, (snapshot) => {
        const data = snapshot.val();
        userProgress = data || {};
        isProgressLoaded = true;
        checkAndRender();
    });

    onValue(lawDatabaseRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            LAW_DATABASE = data.text || "";
            uploadedLawFilesCount = data.count || 0;
            if (uploadedLawFilesCount > 0) {
                lawStatus.innerHTML = `<i class="fa-solid fa-database me-1"></i> Dữ liệu luật: ${uploadedLawFilesCount} file`;
                lawStatus.classList.replace('bg-secondary', 'bg-success');
            } else {
                lawStatus.innerHTML = `<i class="fa-solid fa-database me-1"></i> Dữ liệu luật: 0 file`;
                lawStatus.classList.replace('bg-success', 'bg-secondary');
            }
        }
    });
}

function checkAndRender() {
    if (isDataLoaded && isProgressLoaded) {
        render();
    }
}

function saveStepsData() {
    set(stepsDataRef, stepsData);
}

function saveProgress() {
    set(userProgressRef, userProgress);
}

function loadAiConfig() {
    const savedKey = localStorage.getItem('geminiApiKey');
    if (savedKey) {
        geminiApiKey = savedKey;
        inputApiKey.value = savedKey;
    } else {
        inputApiKey.value = geminiApiKey; // Show default hardcoded key
    }
    
    const savedModel = localStorage.getItem('geminiModelName');
    if (savedModel) {
        geminiModelName = savedModel;
        selGeminiModel.value = savedModel;
    }
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
    // Basic Events
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
                    // Tự động chuyển đổi tên cơ quan cũ nếu có trong file upload
                    newData.forEach(step => {
                        if (step.checklist) {
                            step.checklist.forEach(item => {
                                if (item.agency) {
                                    item.agency = item.agency.replace(/TN&MT/g, "NN&MT");
                                    item.agency = item.agency.replace(/Tài nguyên và Môi trường/g, "Nông nghiệp và Môi trường");
                                }
                            });
                        }
                    });
                    
                    stepsData = newData;
                    saveStepsData();
                    userProgress = {};
                    saveProgress();
                    populateFilters();
                    filterResponsible = "ALL";
                    filterAgency = "ALL";
                    selFilterResponsible.value = "ALL";
                    selFilterAgency.value = "ALL";
                    render();
                    alert("Đã nạp quy trình JSON thành công!");
                } else {
                    alert("Cấu trúc file JSON không hợp lệ.");
                }
            } catch (err) {
                alert("Lỗi đọc file JSON: " + err.message);
            }
        };
        reader.readAsText(file);
        fileUpload.value = '';
    });

    btnReset.addEventListener('click', () => {
        if (confirm("Bạn có chắc chắn muốn đặt lại toàn bộ tiến độ (ảnh hưởng đến tất cả những người đang xem)?")) {
            userProgress = {};
            saveProgress();
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

    // AI Events
    selGeminiModel.addEventListener('change', (e) => {
        geminiModelName = e.target.value;
        localStorage.setItem('geminiModelName', geminiModelName);
    });

    btnSaveKey.addEventListener('click', () => {
        const key = inputApiKey.value.trim();
        if (key) {
            geminiApiKey = key;
            localStorage.setItem('geminiApiKey', key);
            alert("Đã lưu API Key.");
        } else {
            geminiApiKey = "";
            localStorage.removeItem('geminiApiKey');
            alert("Đã xóa API Key.");
        }
    });

    btnUploadLaw.addEventListener('click', () => {
        fileUploadLaw.click();
    });

    fileUploadLaw.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        lawStatus.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-1"></i> Đang đọc file...`;
        
        let newDatabase = LAW_DATABASE;
        for (let i = 0; i < files.length; i++) {
            const text = await files[i].text();
            newDatabase += `\n\n--- [FILE LUẬT: ${files[i].name}] ---\n${text}`;
        }
        
        LAW_DATABASE = newDatabase;
        uploadedLawFilesCount += files.length;
        
        lawStatus.innerHTML = `<i class="fa-solid fa-database me-1"></i> Dữ liệu luật: ${uploadedLawFilesCount} file`;
        lawStatus.classList.replace('bg-secondary', 'bg-success');
        
        try {
            // Đẩy kho luật lên Cloud để đồng nghiệp cũng thấy
            set(lawDatabaseRef, { text: LAW_DATABASE, count: uploadedLawFilesCount });
            
            // Fallback lưu ở local cho an toàn
            localStorage.setItem('LAW_DATABASE', LAW_DATABASE);
            localStorage.setItem('uploadedLawFilesCount', uploadedLawFilesCount.toString());
        } catch (err) {
            console.error("Lỗi khi lưu kho luật:", err);
            alert("Cảnh báo: Kho luật của bạn có thể quá lớn. Đã lưu ở máy cá nhân nhưng có thể không đồng bộ được sang máy đồng nghiệp.");
        }
        
        fileUploadLaw.value = ''; // reset
    });

    btnClearLaw.addEventListener('click', () => {
        if (confirm("Bạn có chắc chắn muốn xóa toàn bộ kho dữ liệu luật (ảnh hưởng đến tất cả những người đang xem) không?")) {
            LAW_DATABASE = "";
            uploadedLawFilesCount = 0;
            set(lawDatabaseRef, { text: "", count: 0 });
            localStorage.removeItem('LAW_DATABASE');
            localStorage.removeItem('uploadedLawFilesCount');
            lawStatus.innerHTML = `<i class="fa-solid fa-database me-1"></i> Dữ liệu luật: 0 file`;
            lawStatus.classList.replace('bg-success', 'bg-secondary');
            alert("Đã xóa dữ liệu luật thành công.");
        }
    });

    // Delegate event for dynamic AI extract buttons
    stepsContainer.addEventListener('click', (e) => {
        if (e.target.closest('.btn-ai-extract')) {
            const btn = e.target.closest('.btn-ai-extract');
            const stepId = parseInt(btn.dataset.stepId, 10);
            extractChecklistWithAI(stepId);
        }
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

// --- RAG RETRIEVAL LOGIC ---
function retrieveRelevantContext(query, text, maxChars = 150000) {
    if (text.length <= maxChars) return text;
    
    // Trích xuất từ khóa từ query (hỗ trợ tiếng Việt)
    const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]/g, ' ');
    const keywords = normalizedQuery.split(' ').filter(k => k.length > 2);
    
    // Chia nhỏ văn bản (theo Điều luật hoặc theo đoạn văn)
    let chunks = text.split(/(?=\n\nĐiều \d+\.)/gi);
    if (chunks.length < 10) {
        chunks = text.split(/\n\n/);
    }
    
    // Chấm điểm từng đoạn văn bản
    const scoredChunks = chunks.map(chunk => {
        let score = 0;
        const chunkLower = chunk.toLowerCase();
        keywords.forEach(kw => {
            if (chunkLower.includes(kw)) score++;
        });
        return { chunk, score };
    });
    
    // Sắp xếp các đoạn có điểm cao (chứa nhiều từ khóa liên quan) lên đầu
    scoredChunks.sort((a, b) => b.score - a.score);
    
    // Gom các đoạn lại cho đến khi đạt giới hạn ký tự (maxChars)
    let result = "";
    for (const item of scoredChunks) {
        if (item.score > 0 || result.length < 20000) {
            if (result.length + item.chunk.length > maxChars) break;
            result += item.chunk + "\n\n";
        }
    }
    return result || text.substring(0, maxChars);
}

// --- AI LOGIC ---
async function extractChecklistWithAI(stepId) {
    if (!geminiApiKey) {
        alert("Vui lòng nhập Gemini API Key ở thanh công cụ phía trên trước khi sử dụng tính năng này!");
        return;
    }
    if (!LAW_DATABASE) {
        alert("Vui lòng nạp kho văn bản pháp luật trước khi yêu cầu AI trích xuất!");
        return;
    }

    const stepIndex = stepsData.findIndex(s => s.step_id === stepId);
    if (stepIndex === -1) return;
    const stepData = stepsData[stepIndex];

    // Set Loading State
    isLoadingAI = stepId;
    render();

    try {
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        
        const query = stepData.step_name + " " + (stepData.step_description || "");
        const relevantLawContext = retrieveRelevantContext(query, LAW_DATABASE, 120000); // ~30k tokens
        
        const prompt = `MỤC TIÊU: Bạn là một trợ lý pháp lý chuyên nghiệp về ngành địa chất, khoáng sản, thủy lợi tại Việt Nam.
NGỮ CẢNH DỰ ÁN: Dự án hiện tại đang ở giai đoạn: ${stepData.step_name} với mô tả: ${stepData.step_description || "Không có"}.
KHO VĂN BẢN PHÁP LUẬT ĐẦU VÀO (Đã được trích lọc phần nội dung liên quan nhất):
${relevantLawContext}

YÊU CẦU: Hãy quét toàn bộ kho văn bản pháp luật đầu vào, tìm và trích xuất tất cả các quy định liên quan đến giai đoạn này để trả về một danh sách Checklist hồ sơ dưới dạng định dạng JSON chuẩn xác theo cấu trúc sau (và tuyệt đối không trả lời thêm chữ nào ngoài JSON):
[
  {
    "doc_name": "Tên văn bản/giấy tờ cụ thể cần chuẩn bị",
    "responsible": "Ghi rõ 'Thuận Phong' hoặc 'Chủ đầu tư' tùy thuộc vào tính chất hồ sơ quy định trong luật",
    "agency": "Tên cơ quan tiếp nhận chính xác (Ví dụ: Sở NN&MT, Sở Nông nghiệp và Môi trường, Sở Tài chính, UBND Tỉnh...). Tuyệt đối không dùng tên cũ là Sở TN&MT hay Sở Tài nguyên và Môi trường.",
    "legal": "Điều mấy, khoản mấy, thuộc văn bản luật nào quy định giấy tờ này",
    "guide": "Nội dung công việc cần làm là gì, quy trình thực hiện, thời gian giải quyết bao nhiêu ngày, các lưu ý quan trọng."
  }
]`;

        let result;
        try {
            const primaryModel = genAI.getGenerativeModel({ model: geminiModelName });
            result = await primaryModel.generateContent(prompt);
        } catch (apiError) {
            console.warn("Lỗi gọi API Model chính:", apiError);
            if (apiError.message && (apiError.message.includes('503') || apiError.message.includes('overloaded'))) {
                console.log("Mô hình chính đang quá tải (503). Đang tự động chuyển sang mô hình dự phòng...");
                const fallbackModelName = geminiModelName === "gemini-2.5-flash" ? "gemini-1.5-pro" : "gemini-2.5-flash";
                const fallbackModel = genAI.getGenerativeModel({ model: fallbackModelName });
                result = await fallbackModel.generateContent(prompt);
            } else {
                throw apiError;
            }
        }
        
        let text = result.response.text();
        
        // Clean JSON markdown blocks if any
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        
        const checklist = JSON.parse(text);
        
        if (Array.isArray(checklist)) {
            // Update the step with new checklist
            stepsData[stepIndex].checklist = checklist;
            saveStepsData();
            
            // Clean up old progress for this step to avoid ghost checked items
            Object.keys(userProgress).forEach(key => {
                if (key.startsWith(`s${stepId}-`)) {
                    delete userProgress[key];
                }
            });
            saveProgress();
            
            populateFilters();
        } else {
            throw new Error("AI did not return a valid JSON array.");
        }
    } catch (err) {
        console.error(err);
        alert("Lỗi khi gọi AI trích xuất: " + err.message);
    } finally {
        isLoadingAI = null;
        render();
    }
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

        // Skip rendering this step if filters hid all its items and it's not empty, 
        // UNLESS it's empty, then we might want to show it so they can click AI Extract
        if (stepTotalSystem > 0 && visibleItemsInStep === 0 && (filterResponsible !== "ALL" || filterAgency !== "ALL")) {
            previousStepCompleted = isStepCompleted;
            return; 
        }

        // Render Step Card
        const card = document.createElement('div');
        card.className = `step-card ${!isUnlocked ? 'locked' : ''} ${isActive ? 'active' : ''} ${isStepCompleted ? 'completed' : ''}`;
        card.id = `step-card-${step.step_id}`;

        // Header
        const header = document.createElement('div');
        header.className = 'step-header flex-wrap';
        
        let statusHtml = '';
        if (!isUnlocked) {
            statusHtml = `<span class="step-status locked"><i class="fa-solid fa-lock"></i> Đã khóa</span>`;
        } else if (stepTotalSystem === 0) {
            statusHtml = `<span class="step-status text-warning"><i class="fa-solid fa-triangle-exclamation"></i> Chưa có dữ liệu</span>`;
        } else if (isStepCompleted) {
            statusHtml = `<span class="step-status completed"><i class="fa-solid fa-circle-check"></i> Hoàn thành</span>`;
        } else {
            statusHtml = `<span class="step-status active"><i class="fa-solid fa-hourglass-half"></i> Đang thực hiện (${stepCompletedSystem}/${stepTotalSystem})</span>`;
        }

        header.innerHTML = `
            <div class="d-flex flex-column w-100 mb-2 mb-md-0 w-md-auto" style="flex:1;">
                <h3 class="step-title">
                    ${isStepCompleted ? '<i class="fa-solid fa-check text-success me-2"></i>' : ''}
                    ${step.step_name}
                </h3>
                ${step.step_description ? `<p class="step-desc">${step.step_description}</p>` : ''}
            </div>
            <div class="d-flex align-items-center gap-3">
                ${statusHtml}
            </div>
        `;
        card.appendChild(header);
        
        // AI Extract Section (Visible if unlocked)
        if (isUnlocked) {
            const aiArea = document.createElement('div');
            aiArea.className = 'ai-extract-area d-flex justify-content-between align-items-center flex-wrap';
            
            if (isLoadingAI === step.step_id) {
                aiArea.innerHTML = `
                    <div class="text-primary fw-semibold">
                        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        AI đang đọc luật và lập checklist cho bước này, vui lòng đợi...
                    </div>
                `;
            } else {
                aiArea.innerHTML = `
                    <span class="text-muted" style="font-size:0.9rem;"><i class="fa-solid fa-wand-magic-sparkles text-warning me-1"></i> Trợ lý AI có thể tự động lập checklist dựa trên dữ liệu luật đã nạp.</span>
                    <button class="btn btn-outline-primary btn-sm btn-ai-extract" data-step-id="${step.step_id}">
                        <i class="fa-solid fa-robot"></i> AI Trích xuất hồ sơ & Hướng dẫn
                    </button>
                `;
            }
            card.appendChild(aiArea);
        }

        // Body (Checklist Items)
        const body = document.createElement('div');
        body.className = 'card-body p-0';

        if (step.checklist.length > 0) {
            step.checklist.forEach((item, itemIndex) => {
                const itemId = `s${step.step_id}-i${itemIndex}`;
                const isChecked = !!userProgress[itemId];
                
                // Apply Filters
                const matchResp = filterResponsible === "ALL" || (item.responsible && item.responsible === filterResponsible);
                const matchAgency = filterAgency === "ALL" || (item.agency && item.agency === filterAgency);
                
                if (!matchResp || !matchAgency) return;
                
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
                        ${isUnlocked ? `
                        <button class="btn btn-sm btn-delete-item text-danger border-0 ps-2" title="Xóa mục này" data-step-id="${step.step_id}" data-item-index="${itemIndex}" style="opacity:0.4; transition:opacity 0.2s; align-self:flex-start; margin-top:2px;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>` : ''}
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

                // Hover effect for delete button
                const delBtn = itemDiv.querySelector('.btn-delete-item');
                if (delBtn) {
                    itemDiv.addEventListener('mouseenter', () => delBtn.style.opacity = '1');
                    itemDiv.addEventListener('mouseleave', () => delBtn.style.opacity = '0.4');
                    delBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const sId = parseInt(e.currentTarget.dataset.stepId);
                        const iIdx = parseInt(e.currentTarget.dataset.itemIndex);
                        if (confirm(`Xóa mục này khỏi danh sách?\n"${step.checklist[iIdx]?.doc_name}"`)) {
                            const targetStep = stepsData.find(s => s.step_id === sId);
                            if (targetStep) {
                                // Also clear progress for items that shift index
                                Object.keys(userProgress).forEach(key => {
                                    if (key.startsWith(`s${sId}-`)) delete userProgress[key];
                                });
                                targetStep.checklist.splice(iIdx, 1);
                                saveStepsData();
                                saveProgress();
                                render();
                            }
                        }
                    });
                }

                body.appendChild(itemDiv);
            });
        }

        // --- ADD ITEM BUTTON ---
        if (isUnlocked) {
            const addRow = document.createElement('div');
            addRow.className = 'add-item-row p-2 px-3';
            addRow.innerHTML = `
                <button class="btn btn-sm btn-add-item w-100" data-step-id="${step.step_id}">
                    <i class="fa-solid fa-plus me-1"></i> Thêm mục hồ sơ mới
                </button>
            `;
            addRow.querySelector('.btn-add-item').addEventListener('click', () => {
                showAddItemModal(step.step_id);
            });
            body.appendChild(addRow);
        }
        
        card.appendChild(body);
        
        // Lock Overlay
        const overlay = document.createElement('div');
        overlay.className = 'lock-overlay';
        overlay.innerHTML = `<div class="lock-icon"><i class="fa-solid fa-lock"></i></div>`;
        card.appendChild(overlay);

        stepsContainer.appendChild(card);

        // Update previousStepCompleted for the next iteration
        // A step with 0 items is technically considered completed if we don't want to block progress,
        // BUT it's better to lock until AI generates it, or consider it uncompleted.
        // Let's say if totalItems === 0, it's not completed, to force AI generation.
        previousStepCompleted = isStepCompleted && stepTotalSystem > 0;
    });
    
    if (stepsContainer.children.length === 0) {
         stepsContainer.innerHTML = `<div class="text-center p-5 text-muted"><i class="fa-solid fa-magnifying-glass fs-2 mb-3"></i><br>Không có hồ sơ nào khớp với bộ lọc hiện tại.</div>`;
    }

    const progressPercent = totalItemsSystem > 0 ? Math.round((completedItemsSystem / totalItemsSystem) * 100) : 0;
    overallProgress.style.width = `${progressPercent}%`;
    overallProgress.setAttribute('aria-valuenow', progressPercent);
    overallProgress.textContent = `${progressPercent}%`;
}

// Start app
document.addEventListener('DOMContentLoaded', init);

// --- ADD ITEM MODAL ---
function showAddItemModal(stepId) {
    // Remove existing modal if any
    const existing = document.getElementById('add-item-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'add-item-modal';
    modal.style.cssText = `
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center; padding: 1rem;
    `;
    modal.innerHTML = `
        <div style="background:#fff; border-radius:16px; padding:2rem; width:100%; max-width:560px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
            <h5 class="fw-bold mb-4" style="color:#1a3a5c;"><i class="fa-solid fa-plus-circle me-2 text-primary"></i>Thêm mục hồ sơ mới</h5>
            <div class="mb-3">
                <label class="form-label fw-semibold">Tên hồ sơ / Giấy tờ <span class="text-danger">*</span></label>
                <input type="text" id="add-doc-name" class="form-control" placeholder="VD: Đơn xin cấp phép khai thác khoáng sản">
            </div>
            <div class="row g-2 mb-3">
                <div class="col-6">
                    <label class="form-label fw-semibold">Bên chịu trách nhiệm</label>
                    <input type="text" id="add-responsible" class="form-control" placeholder="VD: Thuận Phong">
                </div>
                <div class="col-6">
                    <label class="form-label fw-semibold">Cơ quan tiếp nhận</label>
                    <input type="text" id="add-agency" class="form-control" placeholder="VD: Sở NN&MT">
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label fw-semibold">Căn cứ pháp lý</label>
                <input type="text" id="add-legal" class="form-control" placeholder="VD: Điều 5, Luật Khoáng sản 2010">
            </div>
            <div class="mb-4">
                <label class="form-label fw-semibold">Hướng dẫn / Lưu ý</label>
                <textarea id="add-guide" class="form-control" rows="3" placeholder="Mô tả nội dung cần làm, thời gian giải quyết, lưu ý..."></textarea>
            </div>
            <div class="d-flex gap-2 justify-content-end">
                <button id="btn-cancel-add" class="btn btn-outline-secondary">Hủy</button>
                <button id="btn-confirm-add" class="btn btn-primary px-4"><i class="fa-solid fa-floppy-disk me-1"></i>Lưu mục mới</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Focus first field
    setTimeout(() => document.getElementById('add-doc-name').focus(), 100);

    // Cancel
    document.getElementById('btn-cancel-add').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Confirm
    document.getElementById('btn-confirm-add').addEventListener('click', () => {
        const docName = document.getElementById('add-doc-name').value.trim();
        if (!docName) {
            document.getElementById('add-doc-name').classList.add('is-invalid');
            return;
        }
        const newItem = {
            doc_name: docName,
            responsible: document.getElementById('add-responsible').value.trim() || '',
            agency: document.getElementById('add-agency').value.trim() || '',
            legal: document.getElementById('add-legal').value.trim() || '',
            guide: document.getElementById('add-guide').value.trim() || '',
        };
        const targetStep = stepsData.find(s => s.step_id === stepId);
        if (targetStep) {
            targetStep.checklist.push(newItem);
            saveStepsData();
            populateFilters();
            render();
        }
        modal.remove();
    });
}

