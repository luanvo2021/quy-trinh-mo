import { GoogleGenerativeAI } from '@google/generative-ai';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, update, push } from "firebase/database";

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

// --- INITIAL DATA (DUMMY DATA & TEMPLATE FOR NEW PROJECTS) ---
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
        "checklist": []
    }
];

// --- APP STATE ---
let projectsList = {}; // { id: { id, name, description, createdAt, totalItems, completedItems } }
let currentProjectId = "DASHBOARD"; // "DASHBOARD" or specific projectId
let searchQuery = "";
let sortBy = "newest";

// Project specific state (loaded dynamically when entering a project)
let stepsData = [];
let userProgress = {}; // { "s1-i0": true, ... }
let collapsedSteps = JSON.parse(localStorage.getItem('collapsedStepsData') || '{}'); // { stepId: true/false }
let selectedSteps = new Set(); // { stepId1, stepId2 }
let isBypassMode = false;
let filterResponsible = "ALL";
let filterAgency = "ALL";

// AI State
let GLOBAL_LAW_DATABASE = "";
let globalLawFilesCount = 0;
let LAW_DATABASE = "";
let uploadedLawFilesCount = 0;
let geminiApiKey = "";
let geminiModelName = "gemini-2.5-flash";
let isLoadingAI = null; // Track which step is currently loading with AI

// Dynamic unsubscribes for Firebase to prevent leakage
let unsubscribeSteps = null;
let unsubscribeProgress = null;
let unsubscribeLaw = null;

// --- DOM ELEMENTS ---
// Navigation & Views
const dashboardView = document.getElementById('dashboard-view');
const projectDetailView = document.getElementById('project-detail-view');
const btnBackToDashboard = document.getElementById('btn-back-to-dashboard');
const navbarProgressContainer = document.getElementById('navbar-progress-container');
const navbarProjectActions = document.getElementById('navbar-project-actions');
const cloudStatus = document.getElementById('cloud-status');

// Dashboard Elements
const btnAddProject = document.getElementById('btn-add-project');
const projectsGrid = document.getElementById('projects-grid');
const searchProjectsInput = document.getElementById('search-projects');
const sortProjectsSelect = document.getElementById('sort-projects');
const globalLawStatus = document.getElementById('global-law-status');
const btnUploadGlobalLaw = document.getElementById('btn-upload-global-law');
const btnClearGlobalLaw = document.getElementById('btn-clear-global-law');
const fileUploadGlobalLaw = document.getElementById('file-upload-global-law');

const statTotalProjects = document.getElementById('stat-total-projects');
const statCompletedProjects = document.getElementById('stat-completed-projects');
const statAvgProgress = document.getElementById('stat-avg-progress');

// Project Details Elements
const detailProjectName = document.getElementById('detail-project-name');
const detailProjectDesc = document.getElementById('detail-project-desc');
const stepsContainer = document.getElementById('steps-container');
const overallProgress = document.getElementById('overall-progress');
const bypassSwitch = document.getElementById('bypass-switch');
const fileUpload = document.getElementById('file-upload');
const btnLoadData = document.getElementById('btn-load-data');
const btnReset = document.getElementById('btn-reset');
const btnAddStep = document.getElementById('btn-add-step');
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
const btnShowGuideDashboard = document.getElementById('btn-show-guide-dashboard');
const btnShowGuideDetail = document.getElementById('btn-show-guide-detail');

// --- INITIALIZATION ---
function init() {
    loadAiConfig();
    setupEventListeners();
    initFirebaseListeners();
}

function initFirebaseListeners() {
    // Cloud Connection Indicator
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

    // Listen to all projects globally
    const projectsListRef = ref(db, 'projects');
    onValue(projectsListRef, (snapshot) => {
        projectsList = snapshot.val() || {};
        renderDashboard();
        
        // Handle routing once initial project list is loaded
        handleRouting();
    });

    // Listen to global system law database
    const globalLawRef = ref(db, 'globalLawDatabase');
    onValue(globalLawRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            GLOBAL_LAW_DATABASE = data.text || "";
            globalLawFilesCount = data.count || 0;
            if (globalLawFilesCount > 0) {
                globalLawStatus.innerHTML = `<i class="fa-solid fa-database me-1"></i> Luật hệ thống: ${globalLawFilesCount} file`;
                globalLawStatus.classList.replace('bg-secondary', 'bg-success');
            } else {
                globalLawStatus.innerHTML = `<i class="fa-solid fa-database me-1"></i> Luật hệ thống: 0 file`;
                globalLawStatus.classList.replace('bg-success', 'bg-secondary');
            }
        } else {
            GLOBAL_LAW_DATABASE = "";
            globalLawFilesCount = 0;
            globalLawStatus.innerHTML = `<i class="fa-solid fa-database me-1"></i> Dữ liệu luật: 0 file`;
            globalLawStatus.classList.replace('bg-success', 'bg-secondary');
        }
    });
}

// --- ROUTING ENGINE ---
function handleRouting() {
    const hash = window.location.hash;
    if (hash.startsWith('#project-')) {
        const pId = hash.replace('#project-', '');
        if (projectsList[pId]) {
            enterProject(pId);
            return;
        }
    }
    // Default back to dashboard
    exitProject();
}

function enterProject(pId) {
    if (currentProjectId === pId && projectDetailView.style.display === 'flex') return;

    cleanupProjectListeners();
    currentProjectId = pId;
    // collapsedSteps is now persistent across sessions via localStorage
    selectedSteps.clear(); // Reset selection state
    const project = projectsList[pId];
    
    // Set Project Title Headers
    detailProjectName.textContent = project.name;
    detailProjectDesc.textContent = project.description || "Quy trình pháp lý mỏ khoáng sản";

    // Toggle View DOM Elements
    dashboardView.style.display = 'none';
    projectDetailView.style.display = 'flex';
    btnBackToDashboard.style.display = 'inline-block';
    navbarProgressContainer.style.setProperty('display', 'flex', 'important');
    navbarProjectActions.style.setProperty('display', 'flex', 'important');
    navbarProjectActions.classList.remove('d-none');

    // Dynamically Subscribe to project-specific paths
    const stepsDataRef = ref(db, `projectDetails/${pId}/stepsData`);
    const userProgressRef = ref(db, `projectDetails/${pId}/userProgress`);
    const lawDatabaseRef = ref(db, `projectDetails/${pId}/lawDatabase`);

    let isDataLoaded = false;
    let isProgressLoaded = false;

    unsubscribeSteps = onValue(stepsDataRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            // Fix Firebase empty array removal bug
            stepsData = data.map(s => ({...s, checklist: s.checklist || []}));
        } else {
            stepsData = defaultSteps;
            set(stepsDataRef, stepsData);
        }
        isDataLoaded = true;
        populateFilters();
        if (isDataLoaded && isProgressLoaded) render();
    });

    unsubscribeProgress = onValue(userProgressRef, (snapshot) => {
        userProgress = snapshot.val() || {};
        isProgressLoaded = true;
        if (isDataLoaded && isProgressLoaded) render();
    });

    unsubscribeLaw = onValue(lawDatabaseRef, (snapshot) => {
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
        } else {
            LAW_DATABASE = "";
            uploadedLawFilesCount = 0;
            lawStatus.innerHTML = `<i class="fa-solid fa-database me-1"></i> Dữ liệu luật: 0 file`;
            lawStatus.classList.replace('bg-success', 'bg-secondary');
        }
    });
}

function exitProject() {
    cleanupProjectListeners();
    currentProjectId = "DASHBOARD";

    // Toggle View DOM Elements
    dashboardView.style.display = 'flex';
    projectDetailView.style.display = 'none';
    btnBackToDashboard.style.display = 'none';
    navbarProgressContainer.style.setProperty('display', 'none', 'important');
    navbarProjectActions.style.setProperty('display', 'none', 'important');
    navbarProjectActions.classList.add('d-none');

    if (window.location.hash !== '#dashboard' && window.location.hash !== '') {
        window.location.hash = '#dashboard';
    }

    renderDashboard();
}

function cleanupProjectListeners() {
    if (unsubscribeSteps) { unsubscribeSteps(); unsubscribeSteps = null; }
    if (unsubscribeProgress) { unsubscribeProgress(); unsubscribeProgress = null; }
    if (unsubscribeLaw) { unsubscribeLaw(); unsubscribeLaw = null; }
}

// --- PROJECT METRIC / STATS WRITER ---
function updateProjectStats() {
    if (currentProjectId === "DASHBOARD") return;
    
    let totalItems = 0;
    let completedItems = 0;
    
    stepsData.forEach(step => {
        step.checklist.forEach((item, itemIndex) => {
            totalItems++;
            const itemId = `s${step.step_id}-i${itemIndex}`;
            if (userProgress[itemId]) {
                completedItems++;
            }
        });
    });
    
    const projectMetaRef = ref(db, `projects/${currentProjectId}`);
    update(projectMetaRef, {
        totalItems: totalItems,
        completedItems: completedItems
    });
}

// --- PROJECT SAVES ---
function saveStepsData() {
    if (currentProjectId === "DASHBOARD") return;
    const stepsDataRef = ref(db, `projectDetails/${currentProjectId}/stepsData`);
    set(stepsDataRef, stepsData).then(() => {
        updateProjectStats();
    });
}

function saveProgress() {
    if (currentProjectId === "DASHBOARD") return;
    const userProgressRef = ref(db, `projectDetails/${currentProjectId}/userProgress`);
    set(userProgressRef, userProgress).then(() => {
        updateProjectStats();
    });
}

// --- LOAD CONFIG ---
function loadAiConfig() {
    const savedKey = localStorage.getItem('geminiApiKey');
    if (savedKey) {
        geminiApiKey = savedKey;
        inputApiKey.value = savedKey;
    }
    
    let savedModel = localStorage.getItem('geminiModelName');
    if (savedModel === "gemini-1.5-pro") {
        savedModel = "gemini-2.5-pro";
        localStorage.setItem('geminiModelName', savedModel);
    }
    if (savedModel) {
        geminiModelName = savedModel;
        selGeminiModel.value = savedModel;
    }
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    // Hash Routing Listener
    window.addEventListener('hashchange', handleRouting);

    // Dashboard View events
    btnAddProject.addEventListener('click', showAddProjectModal);
    btnBackToDashboard.addEventListener('click', () => { window.location.hash = '#dashboard'; });
    
    searchProjectsInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderDashboard();
    });
    
    sortProjectsSelect.addEventListener('change', (e) => {
        sortBy = e.target.value;
        renderDashboard();
    });

    btnShowGuideDashboard.addEventListener('click', (e) => {
        e.preventDefault();
        showWordToTxtGuideModal();
    });

    btnUploadGlobalLaw.addEventListener('click', () => {
        fileUploadGlobalLaw.click();
    });

    fileUploadGlobalLaw.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        globalLawStatus.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-1"></i> Đang đọc...`;
        
        let newDatabase = GLOBAL_LAW_DATABASE;
        for (let i = 0; i < files.length; i++) {
            const text = await files[i].text();
            newDatabase += `\n\n--- [FILE LUẬT HỆ THỐNG: ${files[i].name}] ---\n${text}`;
        }
        
        GLOBAL_LAW_DATABASE = newDatabase;
        globalLawFilesCount += files.length;
        
        try {
            const globalLawRef = ref(db, 'globalLawDatabase');
            set(globalLawRef, { text: GLOBAL_LAW_DATABASE, count: globalLawFilesCount });
            alert("Đã tải lên luật hệ thống thành công!");
        } catch (err) {
            console.error("Lỗi khi lưu luật hệ thống:", err);
            alert("Lỗi khi lưu kho luật hệ thống lên đám mây.");
        }
        
        fileUploadGlobalLaw.value = '';
    });

    btnClearGlobalLaw.addEventListener('click', () => {
        if (confirm("Bạn có chắc chắn muốn xóa toàn bộ kho dữ liệu luật hệ thống chung (áp dụng cho tất cả các dự án) không?")) {
            GLOBAL_LAW_DATABASE = "";
            globalLawFilesCount = 0;
            const globalLawRef = ref(db, 'globalLawDatabase');
            set(globalLawRef, { text: "", count: 0 });
            alert("Đã xóa dữ liệu luật hệ thống thành công.");
        }
    });

    // Project View events
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
                    // Normalize legacy agency titles and handle missing checklists
                    newData.forEach(step => {
                        step.checklist = step.checklist || [];
                        step.checklist.forEach(item => {
                            if (item.agency) {
                                item.agency = item.agency.replace(/TN&MT/g, "NN&MT");
                                item.agency = item.agency.replace(/Tài nguyên và Môi trường/g, "Nông nghiệp và Môi trường");
                            }
                        });
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
        if (confirm("Bạn có chắc chắn muốn đặt lại toàn bộ tiến độ dự án này (ảnh hưởng đến tất cả các thành viên đang cùng xem)?")) {
            userProgress = {};
            saveProgress();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    btnAddStep.addEventListener('click', showAddStepModal);
    
    document.getElementById('btn-delete-selected-steps').addEventListener('click', () => {
        if (selectedSteps.size === 0) return;
        const confirmed1 = confirm(`⚠️ CẢNH BÁO XÓA NHIỀU BƯỚC!\n\nBạn có thực sự muốn xóa vĩnh viễn ${selectedSteps.size} bước đã chọn?\n\nHành động này sẽ XÓA TOÀN BỘ danh mục Checklist hồ sơ và tiến độ công việc bên trong các bước này TRÊN ĐÁM MÂY (ảnh hưởng đến tất cả đồng nghiệp).\n\nBạn có chắc chắn muốn xóa không?`);
        if (confirmed1) {
            const confirmed2 = confirm(`Nhấp OK để xác nhận lần cuối việc xóa vĩnh viễn ${selectedSteps.size} bước.`);
            if (confirmed2) {
                const stepIdsToDelete = Array.from(selectedSteps);
                stepsData = stepsData.filter(s => !stepIdsToDelete.includes(s.step_id));
                
                stepIdsToDelete.forEach(stepId => {
                    Object.keys(userProgress).forEach(key => {
                        if (key.startsWith(`s${stepId}-`)) {
                            delete userProgress[key];
                        }
                    });
                });
                
                selectedSteps.clear();
                saveStepsData();
                saveProgress();
                populateFilters();
                render();
            }
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

    btnShowGuideDetail.addEventListener('click', (e) => {
        e.preventDefault();
        showWordToTxtGuideModal();
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
            if (currentProjectId !== "DASHBOARD") {
                const lawDatabaseRef = ref(db, `projectDetails/${currentProjectId}/lawDatabase`);
                set(lawDatabaseRef, { text: LAW_DATABASE, count: uploadedLawFilesCount });
            }
        } catch (err) {
            console.error("Lỗi khi lưu kho luật:", err);
            alert("Cảnh báo: Kho luật của bạn có thể quá lớn. Đã lưu ở máy cá nhân nhưng có thể không đồng bộ được sang máy đồng nghiệp.");
        }
        
        fileUploadLaw.value = '';
    });

    btnClearLaw.addEventListener('click', () => {
        if (confirm("Bạn có chắc chắn muốn xóa toàn bộ kho dữ liệu luật của dự án này không?")) {
            LAW_DATABASE = "";
            uploadedLawFilesCount = 0;
            if (currentProjectId !== "DASHBOARD") {
                const lawDatabaseRef = ref(db, `projectDetails/${currentProjectId}/lawDatabase`);
                set(lawDatabaseRef, { text: "", count: 0 });
            }
            lawStatus.innerHTML = `<i class="fa-solid fa-database me-1"></i> Dữ liệu luật: 0 file`;
            lawStatus.classList.replace('bg-success', 'bg-secondary');
            alert("Đã xóa dữ liệu luật thành công.");
        }
    });

    // Delegate event for dynamic AI extract buttons and Delete step buttons
    stepsContainer.addEventListener('click', (e) => {
        if (e.target.closest('.btn-ai-extract')) {
            const btn = e.target.closest('.btn-ai-extract');
            const stepId = parseInt(btn.dataset.stepId, 10);
            extractChecklistWithAI(stepId);
        }

        if (e.target.closest('.btn-delete-step')) {
            const btn = e.target.closest('.btn-delete-step');
            const stepId = parseInt(btn.dataset.stepId, 10);
            const stepName = btn.dataset.stepName;
            
            const confirmed1 = confirm(`⚠️ CẢNH BÁO XÓA BƯỚC QUY TRÌNH!\n\nBạn có thực sự muốn xóa vĩnh viễn bước:\n"${stepName}"\n\nHành động này sẽ XÓA TOÀN BỘ danh mục Checklist hồ sơ và tiến độ công việc bên trong bước này TRÊN ĐÁM MÂY (ảnh hưởng đến tất cả đồng nghiệp).\n\nBạn có chắc chắn muốn xóa không?`);
            if (confirmed1) {
                const confirmed2 = confirm(`Nhấp OK để xác nhận lần cuối việc xóa vĩnh viễn bước "${stepName}".`);
                if (confirmed2) {
                    deleteStep(stepId);
                }
            }
        }

        if (e.target.closest('.btn-toggle-collapse')) {
            const btn = e.target.closest('.btn-toggle-collapse');
            const stepId = parseInt(btn.dataset.stepId, 10);
            collapsedSteps[stepId] = !collapsedSteps[stepId];
            localStorage.setItem('collapsedStepsData', JSON.stringify(collapsedSteps));
            render();
        }
        
        if (e.target.closest('.step-select-checkbox')) {
            const checkbox = e.target.closest('.step-select-checkbox');
            const stepId = parseInt(checkbox.dataset.stepId, 10);
            if (checkbox.checked) {
                selectedSteps.add(stepId);
            } else {
                selectedSteps.delete(stepId);
            }
            updateDeleteSelectedButton();
        }
    });

    stepsContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggable = document.querySelector('.step-card.dragging');
        if (!draggable) return;
        
        const afterElement = getDragAfterElement(stepsContainer, e.clientY);
        if (afterElement == null) {
            stepsContainer.appendChild(draggable);
        } else {
            stepsContainer.insertBefore(draggable, afterElement);
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.step-card:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function saveNewOrder() {
    const newStepsData = [];
    const cardElements = document.querySelectorAll('.step-card');
    cardElements.forEach(card => {
        const id = parseInt(card.id.replace('step-card-', ''), 10);
        const step = stepsData.find(s => s.step_id === id);
        if (step) newStepsData.push(step);
    });
    
    let orderChanged = false;
    if (newStepsData.length === stepsData.length) {
        for(let i=0; i<stepsData.length; i++){
            if(stepsData[i].step_id !== newStepsData[i].step_id) orderChanged = true;
        }
    }
    if (orderChanged) {
        stepsData = newStepsData;
        saveStepsData();
        render(); 
    }
}

// --- ADD PROJECT MODAL ---
function showAddProjectModal() {
    const existing = document.getElementById('add-project-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'add-project-modal';
    modal.style.cssText = `
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center; padding: 1rem;
    `;
    modal.innerHTML = `
        <div style="background:#fff; border-radius:16px; padding:2rem; width:100%; max-width:520px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
            <h5 class="fw-bold mb-4" style="color:#1a3a5c;">
                <i class="fa-solid fa-circle-plus me-2 text-primary"></i>Tạo Dự Án Mới
            </h5>
            <div class="mb-3">
                <label class="form-label fw-semibold">Tên dự án <span class="text-danger">*</span></label>
                <input type="text" id="proj-name" class="form-control" placeholder="VD: Mỏ cát Sông Đồng Nai - Thuận Phong">
            </div>
            <div class="mb-4">
                <label class="form-label fw-semibold">Mô tả ngắn gọn về dự án</label>
                <textarea id="proj-desc" class="form-control" rows="3" placeholder="VD: Địa điểm khai thác, quy mô công suất, thời hạn khai thác..."></textarea>
            </div>
            <div class="d-flex gap-2 justify-content-end">
                <button id="btn-cancel-proj" class="btn btn-outline-secondary">Hủy</button>
                <button id="btn-confirm-proj" class="btn btn-primary px-4"><i class="fa-solid fa-circle-check me-1"></i>Tạo dự án</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    setTimeout(() => document.getElementById('proj-name').focus(), 100);

    document.getElementById('btn-cancel-proj').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    document.getElementById('btn-confirm-proj').addEventListener('click', () => {
        const name = document.getElementById('proj-name').value.trim();
        if (!name) {
            document.getElementById('proj-name').classList.add('is-invalid');
            return;
        }
        const desc = document.getElementById('proj-desc').value.trim() || '';
        
        // Generate dynamic project key
        const newProjRef = push(ref(db, 'projects'));
        const newProjId = newProjRef.key;
        
        const newProjMeta = {
            id: newProjId,
            name: name,
            description: desc,
            createdAt: Date.now(),
            totalItems: 4, // standard default template has 4 total items
            completedItems: 0
        };
        
        const newProjDetails = {
            stepsData: defaultSteps,
            userProgress: {},
            lawDatabase: { text: "", count: 0 }
        };
        
        const updates = {};
        updates[`projects/${newProjId}`] = newProjMeta;
        updates[`projectDetails/${newProjId}`] = newProjDetails;
        
        update(ref(db), updates).then(() => {
            modal.remove();
            window.location.hash = `#project-${newProjId}`;
        }).catch(err => {
            alert("Lỗi tạo dự án: " + err.message);
        });
    });
}

// --- DELETE PROJECT ---
function deleteProject(projectId) {
    const updates = {};
    updates[`projects/${projectId}`] = null;
    updates[`projectDetails/${projectId}`] = null;
    
    update(ref(db), updates).then(() => {
        alert("Đã xóa dự án thành công.");
        if (currentProjectId === projectId) {
            window.location.hash = "#dashboard";
        }
    }).catch(err => {
        alert("Lỗi khi xóa dự án: " + err.message);
    });
}

// --- RENDER DASHBOARD (GRID VIEW) ---
function renderDashboard() {
    projectsGrid.innerHTML = '';
    
    const projectsArray = Object.values(projectsList);
    
    // Search Query Filter
    const query = searchQuery.trim().toLowerCase();
    const filteredProjects = projectsArray.filter(project => {
        return project.name.toLowerCase().includes(query) || 
               (project.description && project.description.toLowerCase().includes(query));
    });
    
    // Sort logic
    filteredProjects.sort((a, b) => {
        if (sortBy === "newest") return b.createdAt - a.createdAt;
        if (sortBy === "oldest") return a.createdAt - b.createdAt;
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "progress") {
            const progressA = a.totalItems > 0 ? (a.completedItems / a.totalItems) : 0;
            const progressB = b.totalItems > 0 ? (b.completedItems / b.totalItems) : 0;
            return progressB - progressA;
        }
        return 0;
    });
    
    // Dashboard Stats Calculation
    const totalProjects = projectsArray.length;
    const completedProjects = projectsArray.filter(p => p.totalItems > 0 && p.completedItems === p.totalItems).length;
    
    let sumProgress = 0;
    projectsArray.forEach(p => {
        if (p.totalItems > 0) {
            sumProgress += (p.completedItems / p.totalItems);
        }
    });
    const avgProgress = totalProjects > 0 ? Math.round((sumProgress / totalProjects) * 100) : 0;
    
    statTotalProjects.textContent = totalProjects;
    statCompletedProjects.textContent = completedProjects;
    statAvgProgress.textContent = `${avgProgress}%`;
    
    if (filteredProjects.length === 0) {
        projectsGrid.innerHTML = `
            <div class="col-12 text-center p-5 text-muted">
                <i class="fa-solid fa-magnifying-glass fs-1 mb-3 text-secondary"></i>
                <h5>Không tìm thấy dự án nào</h5>
                <p>Thử tìm kiếm với từ khóa khác hoặc tạo dự án mới.</p>
            </div>
        `;
        return;
    }
    
    filteredProjects.forEach(project => {
        const total = project.totalItems || 0;
        const completed = project.completedItems || 0;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        const dateStr = new Date(project.createdAt).toLocaleDateString('vi-VN');
        
        const cardCol = document.createElement('div');
        cardCol.className = 'col-md-6 col-lg-4 mb-4';
        
        cardCol.innerHTML = `
            <div class="project-card shadow-sm h-100" style="cursor: pointer;">
                <button class="project-card-delete" title="Xóa dự án" data-project-id="${project.id}" data-project-name="${project.name}">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
                <div class="card-body">
                    <h5 class="project-card-title">${project.name}</h5>
                    <p class="project-card-desc">${project.description || 'Không có mô tả dự án...'}</p>
                    
                    <div class="project-card-meta">
                        <div class="project-progress-label">
                            <span>Tiến độ</span>
                            <span>${percent}% (${completed}/${total} mục)</span>
                        </div>
                        <div class="progress" style="height: 8px; border-radius: 4px; background-color:#e9ecef;">
                            <div class="progress-bar bg-success" style="width: ${percent}%;"></div>
                        </div>
                        <div class="d-flex justify-content-between mt-3 text-muted" style="font-size:0.75rem;">
                            <span><i class="fa-solid fa-calendar-day me-1"></i>${dateStr}</span>
                            <span class="badge ${percent === 100 ? 'badge-completed-projects' : 'badge-pending-projects'}">
                                ${percent === 100 ? 'Hoàn thành' : 'Đang xử lý'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Navigate on card click
        cardCol.querySelector('.project-card').addEventListener('click', (e) => {
            if (e.target.closest('.project-card-delete')) return;
            window.location.hash = `#project-${project.id}`;
        });
        
        // Double-check Delete handler
        cardCol.querySelector('.project-card-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            const projectId = e.currentTarget.dataset.projectId;
            const projectName = e.currentTarget.dataset.projectName;
            
            const confirmed1 = confirm(`⚠️ CẢNH BÁO CỰC KỲ QUAN TRỌNG!\n\nBạn đang chuẩn bị xóa vĩnh viễn dự án:\n"${projectName}"\n\nHành động này sẽ XÓA HẾT quy trình, checklist, tiến độ và kho dữ liệu luật của dự án này TRÊN ĐÁM MÂY (ảnh hưởng đến tất cả đồng nghiệp).\n\nBạn có thực sự muốn xóa?`);
            if (confirmed1) {
                const confirmed2 = confirm(`Nhấp OK để xác nhận lần cuối hành động xóa dự án "${projectName}".`);
                if (confirmed2) {
                    deleteProject(projectId);
                }
            }
        });
        
        projectsGrid.appendChild(cardCol);
    });
}

// --- HELPER FOR ROLES COLORS ---
function getResponsibleBadgeClass(role) {
    if (!role) return 'bg-secondary text-white';
    const lowerRole = role.toLowerCase();
    if (lowerRole.includes('công ty') || lowerRole.includes('thuận phong')) return 'badge-company';
    if (lowerRole.includes('chủ đầu tư') || lowerRole.includes('đối tác')) return 'badge-investor';
    if (lowerRole.includes('phối hợp')) return 'badge-coord';
    
    const colors = ['badge-company', 'badge-investor', 'badge-coord', 'bg-info text-dark', 'bg-dark text-white'];
    let hash = 0;
    for (let i = 0; i < role.length; i++) hash = role.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

// --- RAG RETRIEVAL LOGIC ---
function retrieveRelevantContext(query, text, maxChars = 150000) {
    if (text.length <= maxChars) return text;
    
    const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]/g, ' ');
    const keywords = normalizedQuery.split(' ').filter(k => k.length > 2);
    
    let chunks = text.split(/(?=\n\nĐiều \d+\.)/gi);
    if (chunks.length < 10) {
        chunks = text.split(/\n\n/);
    }
    
    const scoredChunks = chunks.map(chunk => {
        let score = 0;
        const chunkLower = chunk.toLowerCase();
        keywords.forEach(kw => {
            if (chunkLower.includes(kw)) score++;
        });
        return { chunk, score };
    });
    
    scoredChunks.sort((a, b) => b.score - a.score);
    
    let result = "";
    for (const item of scoredChunks) {
        if (item.score > 0 || result.length < 20000) {
            if (result.length + item.chunk.length > maxChars) break;
            result += item.chunk + "\n\n";
        }
    }
    return result || text.substring(0, maxChars);
}

// --- AI CHEKLIST EXTRACTOR ---
async function extractChecklistWithAI(stepId) {
    if (!geminiApiKey) {
        alert("Vui lòng nhập Gemini API Key ở thanh công cụ phía trên trước khi sử dụng tính năng này!");
        return;
    }
    if (!GLOBAL_LAW_DATABASE && !LAW_DATABASE) {
        alert("Vui lòng nạp kho văn bản pháp luật (Luật hệ thống trên Dashboard hoặc Luật dự án) trước khi yêu cầu AI trích xuất!");
        return;
    }

    const stepIndex = stepsData.findIndex(s => s.step_id === stepId);
    if (stepIndex === -1) return;
    const stepData = stepsData[stepIndex];

    if (stepData.checklist && stepData.checklist.length > 0) {
        const confirmed = confirm(
            `⚠️ Cảnh báo!\n\nBước "${stepData.step_name}" đã có ${stepData.checklist.length} mục hồ sơ.\n\nNếu tiếp tục, AI sẽ XÓA TOÀN BỘ nội dung cũ và tạo checklist MỚI (ảnh hưởng đến tất cả mọi người trong nhóm).\n\nBạn có chắc muốn tạo lại không?`
        );
        if (!confirmed) return;
    }

    isLoadingAI = stepId;
    render();

    try {
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        
        const query = stepData.step_name + " " + (stepData.step_description || "");
        const combinedLaw = (GLOBAL_LAW_DATABASE || "") + "\n\n" + (LAW_DATABASE || "");
        
        if (!combinedLaw.trim()) {
            alert("Vui lòng nạp văn bản pháp luật trước khi trích xuất! Bạn có thể nạp 'Luật hệ thống' tại Dashboard chính hoặc 'Nạp Kho Luật' trong dự án chi tiết.");
            isLoadingAI = null;
            render();
            return;
        }
        
        const relevantLawContext = retrieveRelevantContext(query, combinedLaw, 35000);
        
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
            const primaryModel = genAI.getGenerativeModel({ 
                model: geminiModelName,
                generationConfig: { responseMimeType: "application/json" }
            });
            result = await primaryModel.generateContent(prompt);
        } catch (apiError) {
            console.warn("Lỗi gọi API Model chính:", apiError);
            const errText = apiError.message ? apiError.message.toLowerCase() : "";
            const isRetryable = errText.includes('503') || 
                                errText.includes('overloaded') || 
                                errText.includes('429') || 
                                errText.includes('quota') ||
                                errText.includes('rate limit') ||
                                errText.includes('rate_limit');
                                
            if (isRetryable) {
                const fallbackModelName = geminiModelName === "gemini-2.5-flash" ? "gemini-2.5-pro" : "gemini-2.5-flash";
                console.log(`Mô hình chính gặp lỗi giới hạn hoặc quá tải. Đang tự động chuyển sang mô hình dự phòng: ${fallbackModelName}...`);
                try {
                    const fallbackModel = genAI.getGenerativeModel({ 
                        model: fallbackModelName,
                        generationConfig: { responseMimeType: "application/json" }
                    });
                    result = await fallbackModel.generateContent(prompt);
                } catch (fallbackError) {
                    console.error("Lỗi gọi cả Model dự phòng:", fallbackError);
                    throw new Error(`Cả 2 mô hình đều gặp lỗi.\nModel chính (${geminiModelName}): ${apiError.message}\nModel dự phòng (${fallbackModelName}): ${fallbackError.message}`);
                }
            } else {
                throw apiError;
            }
        }
        
        let text = result.response.text();
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        
        const checklist = JSON.parse(text);
        
        if (Array.isArray(checklist)) {
            stepsData[stepIndex].checklist = checklist;
            saveStepsData();
            
            // Clear progress indicators for deleted shifts
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

// --- POPULATE FILTERS ---
function populateFilters() {
    const agencies = new Set();
    const responsibles = new Set();
    
    stepsData.forEach(step => {
        step.checklist.forEach(item => {
            if (item.agency) agencies.add(item.agency.trim());
            if (item.responsible) responsibles.add(item.responsible.trim());
        });
    });
    
    selFilterAgency.innerHTML = '<option value="ALL">-- Tất cả cơ quan tiếp nhận --</option>';
    Array.from(agencies).sort().forEach(agency => {
        const option = document.createElement('option');
        option.value = agency;
        option.textContent = agency;
        selFilterAgency.appendChild(option);
    });
    
    selFilterResponsible.innerHTML = '<option value="ALL">-- Tất cả bên chịu trách nhiệm --</option>';
    Array.from(responsibles).sort().forEach(resp => {
        const option = document.createElement('option');
        option.value = resp;
        option.textContent = resp;
        selFilterResponsible.appendChild(option);
    });
}

// --- RENDER DETAIL PROJECT VIEW ---
function render() {
    stepsContainer.innerHTML = '';
    
    let totalItemsSystem = 0;
    let completedItemsSystem = 0;
    let previousStepCompleted = true;

    stepsData.forEach((step, stepIndex) => {
        let stepTotalSystem = step.checklist.length;
        let stepCompletedSystem = 0;
        let visibleItemsInStep = 0;

        step.checklist.forEach((item, itemIndex) => {
            const itemId = `s${step.step_id}-i${itemIndex}`;
            totalItemsSystem++;
            if (userProgress[itemId]) {
                stepCompletedSystem++;
                completedItemsSystem++;
            }
            
            const matchResp = filterResponsible === "ALL" || (item.responsible && item.responsible === filterResponsible);
            const matchAgency = filterAgency === "ALL" || (item.agency && item.agency === filterAgency);
            if (matchResp && matchAgency) {
                visibleItemsInStep++;
            }
        });

        const isStepCompleted = (stepCompletedSystem === stepTotalSystem && stepTotalSystem > 0);
        const isUnlocked = isBypassMode || stepIndex === 0 || previousStepCompleted;
        const isActive = isUnlocked && !isStepCompleted;
        const isCollapsed = !!collapsedSteps[step.step_id];
        const isSelected = selectedSteps.has(step.step_id);

        if (stepTotalSystem > 0 && visibleItemsInStep === 0 && (filterResponsible !== "ALL" || filterAgency !== "ALL")) {
            previousStepCompleted = isStepCompleted;
            return; 
        }

        const card = document.createElement('div');
        card.className = `step-card ${!isUnlocked ? 'locked' : ''} ${isActive ? 'active' : ''} ${isStepCompleted ? 'completed' : ''} ${isCollapsed ? 'collapsed' : ''} ${isSelected ? 'selected' : ''}`;
        card.id = `step-card-${step.step_id}`;

        card.addEventListener('dragstart', (e) => {
            card.classList.add('dragging');
        });
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            card.draggable = false;
            saveNewOrder();
        });

        const header = document.createElement('div');
        header.className = 'step-header flex-wrap';
        
        header.style.cursor = 'pointer';
        header.title = "Nhấp để mở/đóng checklist";
        header.onclick = (e) => {
            if (!e.target.closest('.btn-delete-step') && !e.target.closest('.step-select-checkbox') && !e.target.closest('.btn-drag-handle')) {
                collapsedSteps[step.step_id] = !collapsedSteps[step.step_id];
                localStorage.setItem('collapsedStepsData', JSON.stringify(collapsedSteps));
                render();
            }
        };
        
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
                <h3 class="step-title d-flex align-items-center">
                    <span class="btn-drag-handle p-1 px-2 me-2 text-muted" title="Nhấn giữ để kéo thả thay đổi thứ tự" style="cursor: grab; font-size: 1.1rem;"><i class="fa-solid fa-grip-vertical"></i></span>
                    <input type="checkbox" class="form-check-input step-select-checkbox me-2 mt-0" data-step-id="${step.step_id}" ${isSelected ? 'checked' : ''} title="Chọn để xóa bước">
                    <button class="btn btn-sm btn-light btn-toggle-collapse p-1 px-2 me-2" data-step-id="${step.step_id}"><i class="fa-solid ${isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}"></i></button>
                    ${isStepCompleted ? '<i class="fa-solid fa-check text-success me-2"></i>' : ''}
                    ${step.step_name}
                </h3>
                ${step.step_description ? `<p class="step-desc ms-4">${step.step_description}</p>` : ''}
            </div>
            <div class="d-flex align-items-center gap-3">
                ${statusHtml}
                <button class="btn btn-sm btn-outline-danger border-0 btn-delete-step p-1" data-step-id="${step.step_id}" data-step-name="${step.step_name}" title="Xóa bước quy trình này" style="line-height:1; display:flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:50%; z-index: 2; position: relative;">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
        
        const dragHandle = header.querySelector('.btn-drag-handle');
        if (dragHandle) {
            dragHandle.addEventListener('mousedown', () => card.draggable = true);
            dragHandle.addEventListener('mouseup', () => card.draggable = false);
        }
        card.addEventListener('mouseleave', () => card.draggable = false);

        card.appendChild(header);
        
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
                const hasChecklist = step.checklist.length > 0;
                if (hasChecklist) {
                    aiArea.innerHTML = `
                        <span class="text-muted" style="font-size:0.85rem;"><i class="fa-solid fa-circle-check text-success me-1"></i> Đã có checklist (${step.checklist.length} mục). Chỉnh sửa thủ công hoặc tạo lại bằng AI.</span>
                        <button class="btn btn-outline-secondary btn-sm btn-ai-extract" data-step-id="${step.step_id}" title="Cảnh báo: Sẽ xóa toàn bộ checklist hiện tại và tạo mới bằng AI">
                            <i class="fa-solid fa-rotate-right"></i> Tạo lại bằng AI
                        </button>
                    `;
                } else {
                    aiArea.innerHTML = `
                        <span class="text-muted" style="font-size:0.9rem;"><i class="fa-solid fa-wand-magic-sparkles text-warning me-1"></i> Trợ lý AI có thể tự động lập checklist dựa trên dữ liệu luật đã nạp.</span>
                        <button class="btn btn-outline-primary btn-sm btn-ai-extract" data-step-id="${step.step_id}">
                            <i class="fa-solid fa-robot"></i> AI Trích xuất hồ sơ &amp; Hướng dẫn
                        </button>
                    `;
                }
            }
            card.appendChild(aiArea);
        }

        const body = document.createElement('div');
        body.className = 'card-body p-0';

        if (step.checklist.length > 0) {
            step.checklist.forEach((item, itemIndex) => {
                const itemId = `s${step.step_id}-i${itemIndex}`;
                const isChecked = !!userProgress[itemId];
                
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
                
                const checkbox = itemDiv.querySelector('input[type="checkbox"]');
                checkbox.addEventListener('change', (e) => {
                    userProgress[itemId] = e.target.checked;
                    saveProgress();
                    
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
        
        const overlay = document.createElement('div');
        overlay.className = 'lock-overlay';
        overlay.innerHTML = `<div class="lock-icon"><i class="fa-solid fa-lock"></i></div>`;
        body.appendChild(overlay);

        card.appendChild(body);

        stepsContainer.appendChild(card);
        previousStepCompleted = isStepCompleted && stepTotalSystem > 0;
    });
    
    if (stepsContainer.children.length === 0) {
         stepsContainer.innerHTML = `<div class="text-center p-5 text-muted"><i class="fa-solid fa-magnifying-glass fs-2 mb-3"></i><br>Không có hồ sơ nào khớp với bộ lọc hiện tại.</div>`;
    }

    const progressPercent = totalItemsSystem > 0 ? Math.round((completedItemsSystem / totalItemsSystem) * 100) : 0;
    overallProgress.style.width = `${progressPercent}%`;
    overallProgress.setAttribute('aria-valuenow', progressPercent);
    overallProgress.textContent = `${progressPercent}%`;

    updateDeleteSelectedButton();
}

function updateDeleteSelectedButton() {
    const btn = document.getElementById('btn-delete-selected-steps');
    const countSpan = document.getElementById('selected-steps-count');
    if (!btn || !countSpan) return;
    
    if (selectedSteps.size > 0) {
        btn.style.display = 'inline-block';
        countSpan.textContent = selectedSteps.size;
    } else {
        btn.style.display = 'none';
    }
}

// --- ADD CHECKLIST ITEM MODAL ---
function showAddItemModal(stepId) {
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

    setTimeout(() => document.getElementById('add-doc-name').focus(), 100);

    document.getElementById('btn-cancel-add').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

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

// --- DELETE STEP ---
function deleteStep(stepId) {
    const stepIndex = stepsData.findIndex(s => s.step_id === stepId);
    if (stepIndex !== -1) {
        // Clean up user progress for items belonging to this step
        Object.keys(userProgress).forEach(key => {
            if (key.startsWith(`s${stepId}-`)) {
                delete userProgress[key];
            }
        });
        
        stepsData.splice(stepIndex, 1);
        saveStepsData();
        saveProgress();
        populateFilters();
        render();
    }
}

// --- ADD STEP MODAL ---
function showAddStepModal() {
    const existing = document.getElementById('add-step-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'add-step-modal';
    modal.style.cssText = `
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center; padding: 1rem;
    `;
    modal.innerHTML = `
        <div style="background:#fff; border-radius:16px; padding:2rem; width:100%; max-width:520px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
            <h5 class="fw-bold mb-4" style="color:#1a3a5c;">
                <i class="fa-solid fa-folder-plus me-2 text-primary"></i>Thêm Bước Quy Trình Mới
            </h5>
            <div class="mb-3">
                <label class="form-label fw-semibold">Tên bước <span class="text-danger">*</span></label>
                <input type="text" id="new-step-name" class="form-control" placeholder="VD: Bước 4: Xin giao đất và thuê đất">
            </div>
            <div class="mb-4">
                <label class="form-label fw-semibold">Mô tả ngắn về bước này</label>
                <textarea id="new-step-desc" class="form-control" rows="3" placeholder="Mô tả nội dung công việc chính của bước này..."></textarea>
            </div>
            <div class="d-flex gap-2 justify-content-end">
                <button id="btn-cancel-step" class="btn btn-outline-secondary">Hủy</button>
                <button id="btn-confirm-step" class="btn btn-primary px-4"><i class="fa-solid fa-circle-check me-1"></i>Thêm bước</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    setTimeout(() => document.getElementById('new-step-name').focus(), 100);

    document.getElementById('btn-cancel-step').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    document.getElementById('btn-confirm-step').addEventListener('click', () => {
        const name = document.getElementById('new-step-name').value.trim();
        if (!name) {
            document.getElementById('new-step-name').classList.add('is-invalid');
            return;
        }
        const desc = document.getElementById('new-step-desc').value.trim() || '';
        
        const newStep = {
            step_id: Date.now(), // Unique ID based on timestamp
            step_name: name,
            step_description: desc,
            checklist: []
        };
        
        stepsData.push(newStep);
        saveStepsData();
        render();
        modal.remove();
        
        // Auto scroll to the newly created step
        setTimeout(() => {
            const newStepCard = document.getElementById(`step-card-${newStep.step_id}`);
            if (newStepCard) {
                newStepCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    });
}

// --- WORD TO TXT UTF-8 CONVERSION GUIDE MODAL ---
function showWordToTxtGuideModal() {
    const existing = document.getElementById('word-to-txt-guide-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'word-to-txt-guide-modal';
    modal.style.cssText = `
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(0,0,0,0.6); backdrop-filter: blur(5px);
        display: flex; align-items: center; justify-content: center; padding: 1rem;
    `;
    modal.innerHTML = `
        <div style="background:#fff; border-radius:18px; padding:2rem; width:100%; max-width:760px; box-shadow: 0 25px 70px rgba(0,0,0,0.35); max-height: 90vh; overflow-y: auto;">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4 class="fw-bold m-0" style="color:#1a3a5c;">
                    <i class="fa-solid fa-file-word me-2 text-primary"></i>Hướng dẫn chuyển đổi Word (.docx) sang TXT UTF-8
                </h4>
                <button id="btn-close-guide-top" class="btn-close" aria-label="Close"></button>
            </div>
            
            <p class="text-muted small mb-3">
                * Trợ lý AI của chúng ta cần đọc dữ liệu luật thô chuẩn định dạng văn bản Plain Text (UTF-8) để trích xuất không bị lỗi phông chữ tiếng Việt. Hãy thực hiện 5 bước cực kỳ đơn giản sau đây trong Microsoft Word:
            </p>

            <div class="table-responsive mb-4">
                <table class="table table-bordered table-hover align-middle m-0" style="border-radius: 8px; overflow: hidden; font-size: 0.92rem;">
                    <thead class="bg-navy text-white">
                        <tr>
                            <th class="text-center" style="width: 80px; background-color: #1a3a5c;">Bước</th>
                            <th style="background-color: #1a3a5c;">Thao tác trên Microsoft Word</th>
                            <th style="background-color: #1a3a5c; width: 220px;">Mục tiêu &amp; Kết quả</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="text-center fw-bold text-primary">Bước 1</td>
                            <td>Mở văn bản pháp luật, tài liệu của bạn (file <strong>.doc</strong> hoặc <strong>.docx</strong>) trong phần mềm Microsoft Word.</td>
                            <td class="text-muted italic">Chuẩn bị văn bản.</td>
                        </tr>
                        <tr>
                            <td class="text-center fw-bold text-primary">Bước 2</td>
                            <td>Nhấn vào menu <strong>File</strong> ở góc trên cùng bên trái màn hình ➔ Chọn <strong>Save As</strong> (hoặc nhấn trực tiếp phím tắt <strong>F12</strong>).</td>
                            <td class="text-muted italic">Mở hộp thoại lưu tệp.</td>
                        </tr>
                        <tr>
                            <td class="text-center fw-bold text-primary">Bước 3</td>
                            <td>Tại ô <strong>Save as type</strong> (Định dạng tệp), hãy chọn định dạng <strong>Plain Text (*.txt)</strong>. Điền tên file tùy ý rồi nhấn <strong>Save</strong>.</td>
                            <td class="text-muted italic">Đổi định dạng sang tệp văn bản.</td>
                        </tr>
                        <tr>
                            <td class="text-center fw-bold text-primary">Bước 4</td>
                            <td>Hộp thoại <strong>File Conversion</strong> (Chuyển đổi tệp) sẽ hiện ra. Tích chọn vào mục <strong>Other encoding</strong> ở cột bên phải ➔ Tìm và nhấp chọn <strong>Unicode (UTF-8)</strong> trong danh sách.</td>
                            <td class="text-success fw-semibold"><i class="fa-solid fa-circle-check"></i> Mã hóa tiếng Việt chuẩn mã UTF-8 (không bị lỗi phông).</td>
                        </tr>
                        <tr>
                            <td class="text-center fw-bold text-primary">Bước 5</td>
                            <td>Nhấn <strong>OK</strong> để hoàn tất. Bạn đã sở hữu file <strong>.txt</strong> chuẩn mã hóa UTF-8 sẵn sàng nạp trực tiếp vào hệ thống!</td>
                            <td class="text-primary fw-semibold"><i class="fa-solid fa-flag-checkered"></i> File sẵn sàng sử dụng.</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="d-flex justify-content-end">
                <button id="btn-close-guide-bottom" class="btn btn-secondary px-4"><i class="fa-solid fa-circle-xmark me-1"></i>Đóng hướng dẫn</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('btn-close-guide-top').addEventListener('click', close);
    document.getElementById('btn-close-guide-bottom').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
}

// Start app
document.addEventListener('DOMContentLoaded', init);
