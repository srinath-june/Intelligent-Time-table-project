let appData = {
    days: [],
    periods: [],
    rooms: [],
    teachers: [],
    subjects: [],
    classes: []
};

let currentTimetable = [];
let currentSlotToEdit = null;
let currentTrajectory = [];
let currentAnalytics = {};
let draggedGene = null;

document.addEventListener("DOMContentLoaded", () => {
    initTabs();
    initEventListeners();
    loadAppData();
});

function initTabs() {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            btn.classList.add("active");
            const target = document.getElementById(btn.dataset.tab);
            target.classList.add("active");

            if (btn.dataset.tab === "tab-analytics") {
                renderAnalytics();
                renderEvolutionChart();
            }
        });
    });

    document.querySelectorAll(".data-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".data-tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".subtab-content").forEach(c => c.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById(btn.dataset.subtab).classList.add("active");
        });
    });
}

function initEventListeners() {
    document.getElementById("btn-generate-top").addEventListener("click", runSolver);
    document.getElementById("btn-run-solver").addEventListener("click", runSolver);
    document.getElementById("btn-reset-data").addEventListener("click", resetData);
    document.getElementById("preset-selector").addEventListener("change", changePreset);
    document.getElementById("btn-export-csv").addEventListener("click", exportCSV);
    document.getElementById("btn-print").addEventListener("click", () => window.print());

    document.getElementById("view-mode-select").addEventListener("change", populateTargetOptions);
    document.getElementById("view-target-select").addEventListener("change", renderTimetableGrid);

    document.getElementById("form-edit-slot").addEventListener("submit", saveSlotEdit);
    document.getElementById("form-add-class").addEventListener("submit", addClass);
    document.getElementById("form-add-teacher").addEventListener("submit", addTeacher);
    document.getElementById("form-add-subject").addEventListener("submit", addSubject);
    document.getElementById("form-add-room").addEventListener("submit", addRoom);
}

async function loadAppData() {
    try {
        const res = await fetch("/api/data");
        const json = await res.json();
        if (json.status === "success") {
            appData = json.data;
            currentTimetable = json.current_timetable || [];
            currentTrajectory = json.trajectory || [];
            currentAnalytics = json.analytics || {};

            updateStats(json.fitness || 0, json.hard_violations || [], json.soft_violations || [], 0);
            renderDataManagement();
            populateTargetOptions();
            if (currentTimetable.length > 0) {
                renderTimetableGrid();
                renderViolations(json.hard_violations || [], json.soft_violations || []);
            }
        }
    } catch (err) {
        console.error("Failed to load application data:", err);
    }
}

async function runSolver() {
    showLoading(true);
    const popSize = document.getElementById("input-pop-size").value;
    const gen = document.getElementById("input-generations").value;
    const mut = document.getElementById("input-mutation").value;

    try {
        const res = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pop_size: popSize, generations: gen, mutation_rate: mut })
        });
        const json = await res.json();
        showLoading(false);

        if (json.status === "success") {
            currentTimetable = json.timetable;
            currentTrajectory = json.trajectory || [];
            currentAnalytics = json.analytics || {};

            updateStats(json.fitness, json.hard_violations, json.soft_violations, json.execution_time_seconds);
            renderTimetableGrid();
            renderViolations(json.hard_violations, json.soft_violations);
            
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            document.querySelector('[data-tab="tab-grid"]').classList.add("active");
            document.getElementById("tab-grid").classList.add("active");
        }
    } catch (err) {
        showLoading(false);
        alert("Error running solver engine.");
    }
}

async function changePreset() {
    const preset = document.getElementById("preset-selector").value;
    showLoading(true);
    try {
        const res = await fetch("/api/reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ preset: preset })
        });
        const json = await res.json();
        showLoading(false);
        if (json.status === "success") {
            appData = json.data;
            currentTimetable = [];
            currentTrajectory = [];
            currentAnalytics = {};
            updateStats(0, [], [], 0);
            renderDataManagement();
            populateTargetOptions();
            renderTimetableGrid();
            renderViolations([], []);
        }
    } catch (err) {
        showLoading(false);
    }
}

async function resetData() {
    if (!confirm("Are you sure you want to reset to default dataset?")) return;
    changePreset();
}

function updateStats(fitness, hardViolations, softViolations, execTime) {
    document.getElementById("stat-fitness").innerText = `${fitness} / 1000`;
    const pct = Math.min(100, Math.max(0, (fitness / 1000) * 100));
    document.getElementById("fitness-progress").style.width = `${pct}%`;

    const hardEl = document.getElementById("stat-hard-conflicts");
    hardEl.innerText = hardViolations.length;
    if (hardViolations.length === 0) {
        hardEl.className = "stat-value text-success";
    } else {
        hardEl.className = "stat-value text-danger";
    }

    document.getElementById("stat-soft-warnings").innerText = softViolations.length;
    document.getElementById("stat-exec-time").innerText = `${execTime} s`;
}

function populateTargetOptions() {
    const mode = document.getElementById("view-mode-select").value;
    const targetSelect = document.getElementById("view-target-select");
    targetSelect.innerHTML = "";

    if (mode === "class") {
        appData.classes.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.innerText = `${c.name} (${c.id})`;
            targetSelect.appendChild(opt);
        });
    } else if (mode === "teacher") {
        appData.teachers.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.id;
            opt.innerText = t.name;
            targetSelect.appendChild(opt);
        });
    } else if (mode === "room") {
        appData.rooms.forEach(r => {
            const opt = document.createElement("option");
            opt.value = r.id;
            opt.innerText = `${r.name} (${r.room_type})`;
            targetSelect.appendChild(opt);
        });
    }

    renderTimetableGrid();
}

function renderTimetableGrid() {
    const tbody = document.getElementById("timetable-tbody");
    tbody.innerHTML = "";

    if (!currentTimetable || currentTimetable.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fa-solid fa-calendar-xmark"></i>
                    <p>No timetable generated yet. Click <strong>Generate Timetable</strong> to run the AI engine.</p>
                </td>
            </tr>`;
        return;
    }

    const mode = document.getElementById("view-mode-select").value;
    const targetId = document.getElementById("view-target-select").value;
    const days = appData.days;
    const periods = appData.periods;

    const headerRow = document.getElementById("matrix-header-row");
    headerRow.innerHTML = `<th>Time / Day</th>`;
    days.forEach(d => {
        headerRow.innerHTML += `<th>${d}</th>`;
    });

    periods.forEach((periodStr, pIdx) => {
        const tr = document.createElement("tr");

        const tdPeriod = document.createElement("td");
        tdPeriod.className = "period-header";
        tdPeriod.innerHTML = `<div>Period ${pIdx + 1}</div><div style="font-size: 0.7rem; font-weight: normal; opacity: 0.8">${periodStr}</div>`;
        tr.appendChild(tdPeriod);

        days.forEach(day => {
            const td = document.createElement("td");
            td.dataset.day = day;
            td.dataset.period = pIdx;

            td.ondragover = (e) => {
                e.preventDefault();
                td.classList.add("drag-over");
            };
            td.ondragleave = () => td.classList.remove("drag-over");
            td.ondrop = (e) => handleDrop(e, day, pIdx);

            let matchedGene = null;
            if (mode === "class") {
                matchedGene = currentTimetable.find(g => g.class_id === targetId && g.day === day && g.period_idx === pIdx);
            } else if (mode === "teacher") {
                matchedGene = currentTimetable.find(g => g.teacher_id === targetId && g.day === day && g.period_idx === pIdx);
            } else if (mode === "room") {
                matchedGene = currentTimetable.find(g => g.room_id === targetId && g.day === day && g.period_idx === pIdx);
            }

            if (matchedGene) {
                const subjObj = appData.subjects.find(s => s.id === matchedGene.subject_id) || {};
                const teacherObj = appData.teachers.find(t => t.id === matchedGene.teacher_id) || {};
                const roomObj = appData.rooms.find(r => r.id === matchedGene.room_id) || {};
                const classObj = appData.classes.find(c => c.id === matchedGene.class_id) || {};

                const isLab = subjObj.subject_type === "Lab";
                const card = document.createElement("div");
                card.className = `slot-card ${isLab ? "slot-lab" : ""}`;
                card.draggable = true;
                card.ondragstart = (e) => {
                    draggedGene = matchedGene;
                    e.dataTransfer.setData("text/plain", matchedGene.slot_id);
                };
                card.onclick = () => openEditSlotModal(matchedGene);

                card.innerHTML = `
                    <div class="slot-subject">
                        <span>${subjObj.name || matchedGene.subject_id}</span>
                        <i class="fa-solid fa-grip-dots-vertical" style="opacity:0.4; font-size: 0.75rem;"></i>
                    </div>
                    <div class="slot-meta">
                        <span><i class="fa-solid fa-users"></i> ${classObj.name || matchedGene.class_id}</span>
                        <span><i class="fa-solid fa-user-tie"></i> ${teacherObj.name || matchedGene.teacher_id}</span>
                        <span><i class="fa-solid fa-door-open"></i> ${roomObj.name || matchedGene.room_id}</span>
                    </div>
                `;
                td.appendChild(card);
            } else {
                td.innerHTML = `<div class="slot-empty">Free</div>`;
            }

            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

async function handleDrop(e, targetDay, targetPeriodIdx) {
    e.preventDefault();
    document.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));

    if (!draggedGene) return;

    draggedGene.day = targetDay;
    draggedGene.period_idx = targetPeriodIdx;
    draggedGene = null;

    renderTimetableGrid();

    try {
        const res = await fetch("/api/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timetable: currentTimetable })
        });
        const json = await res.json();
        if (json.status === "success") {
            currentAnalytics = json.analytics || {};
            updateStats(json.fitness, json.hard_violations, json.soft_violations, 0);
            renderViolations(json.hard_violations, json.soft_violations);
        }
    } catch (err) {}
}

function renderEvolutionChart() {
    const canvas = document.getElementById("canvas-evolution");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!currentTrajectory || currentTrajectory.length === 0) {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "14px 'Plus Jakarta Sans'";
        ctx.textAlign = "center";
        ctx.fillText("Run the Genetic Algorithm to view the live evolution curve.", canvas.width / 2, canvas.height / 2);
        return;
    }

    const padding = 40;
    const w = canvas.width - padding * 2;
    const h = canvas.height - padding * 2;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
        const y = padding + (h / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(canvas.width - padding, y);
        ctx.stroke();

        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(1000 - i * 250, padding - 8, y + 3);
    }

    const maxGen = currentTrajectory.length;
    ctx.beginPath();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2.5;

    currentTrajectory.forEach((pt, idx) => {
        const x = padding + (idx / (maxGen - 1 || 1)) * w;
        const y = padding + h - (pt.fitness / 1000) * h;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });

    ctx.stroke();

    const last = currentTrajectory[currentTrajectory.length - 1];
    if (last) {
        const lx = padding + w;
        const ly = padding + h - (last.fitness / 1000) * h;
        ctx.fillStyle = "#10b981";
        ctx.beginPath();
        ctx.arc(lx, ly, 5, 0, Math.PI * 2);
        ctx.fill();
    }
}

function renderAnalytics() {
    const roomBox = document.getElementById("analytics-rooms");
    roomBox.innerHTML = "";

    const roomUtil = currentAnalytics.room_utilization || {};
    Object.keys(roomUtil).forEach(rName => {
        const info = roomUtil[rName];
        const item = document.createElement("div");
        item.className = "analytics-item";
        item.innerHTML = `
            <div class="analytics-item-header">
                <span>${rName} (${info.type})</span>
                <span>${info.percentage}%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${info.percentage}%"></div>
            </div>
        `;
        roomBox.appendChild(item);
    });

    const teacherGrid = document.getElementById("analytics-teachers");
    teacherGrid.innerHTML = "";

    const tHours = currentAnalytics.teacher_hours || {};
    Object.keys(tHours).forEach(tName => {
        const hrs = tHours[tName];
        const card = document.createElement("div");
        card.className = "workload-card";
        const initial = tName.charAt(0);
        card.innerHTML = `
            <div class="workload-avatar">${initial}</div>
            <div class="workload-info">
                <h5>${tName}</h5>
                <p><i class="fa-solid fa-clock"></i> ${hrs} hrs/week assigned</p>
            </div>
        `;
        teacherGrid.appendChild(card);
    });
}

function openEditSlotModal(gene) {
    currentSlotToEdit = gene;
    document.getElementById("edit-slot-id").value = gene.slot_id;
    document.getElementById("edit-slot-class").value = gene.class_id;

    const subjSelect = document.getElementById("edit-slot-subject");
    subjSelect.innerHTML = "";
    appData.subjects.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.innerText = `${s.name} (${s.code})`;
        if (s.id === gene.subject_id) opt.selected = true;
        subjSelect.appendChild(opt);
    });

    const tSelect = document.getElementById("edit-slot-teacher");
    tSelect.innerHTML = "";
    appData.teachers.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.innerText = t.name;
        if (t.id === gene.teacher_id) opt.selected = true;
        tSelect.appendChild(opt);
    });

    const rSelect = document.getElementById("edit-slot-room");
    rSelect.innerHTML = "";
    appData.rooms.forEach(r => {
        const opt = document.createElement("option");
        opt.value = r.id;
        opt.innerText = `${r.name} (${r.room_type})`;
        if (r.id === gene.room_id) opt.selected = true;
        rSelect.appendChild(opt);
    });

    const dSelect = document.getElementById("edit-slot-day");
    dSelect.innerHTML = "";
    appData.days.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.innerText = d;
        if (d === gene.day) opt.selected = true;
        dSelect.appendChild(opt);
    });

    const pSelect = document.getElementById("edit-slot-period");
    pSelect.innerHTML = "";
    appData.periods.forEach((p, idx) => {
        const opt = document.createElement("option");
        opt.value = idx;
        opt.innerText = `Period ${idx + 1} (${p})`;
        if (idx === gene.period_idx) opt.selected = true;
        pSelect.appendChild(opt);
    });

    openModal("modal-edit-slot");
}

async function saveSlotEdit(e) {
    e.preventDefault();
    if (!currentSlotToEdit) return;

    currentSlotToEdit.subject_id = document.getElementById("edit-slot-subject").value;
    currentSlotToEdit.teacher_id = document.getElementById("edit-slot-teacher").value;
    currentSlotToEdit.room_id = document.getElementById("edit-slot-room").value;
    currentSlotToEdit.day = document.getElementById("edit-slot-day").value;
    currentSlotToEdit.period_idx = parseInt(document.getElementById("edit-slot-period").value);

    closeModal("modal-edit-slot");
    renderTimetableGrid();

    try {
        const res = await fetch("/api/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timetable: currentTimetable })
        });
        const json = await res.json();
        if (json.status === "success") {
            currentAnalytics = json.analytics || {};
            updateStats(json.fitness, json.hard_violations, json.soft_violations, 0);
            renderViolations(json.hard_violations, json.soft_violations);
        }
    } catch (err) {}
}

function renderViolations(hardViolations, softViolations) {
    const hardBox = document.getElementById("hard-violations-list");
    hardBox.innerHTML = "";
    if (hardViolations.length === 0) {
        hardBox.innerHTML = `<div class="no-issues"><i class="fa-solid fa-circle-check text-success"></i> No hard violations detected! Schedule is 100% valid.</div>`;
    } else {
        hardViolations.forEach(v => {
            const tag = document.createElement("div");
            tag.className = "violation-tag hard";
            tag.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${v}`;
            hardBox.appendChild(tag);
        });
    }

    const softBox = document.getElementById("soft-violations-list");
    softBox.innerHTML = "";
    if (softViolations.length === 0) {
        softBox.innerHTML = `<div class="no-issues"><i class="fa-solid fa-circle-check text-success"></i> All soft constraints satisfied!</div>`;
    } else {
        softViolations.forEach(v => {
            const tag = document.createElement("div");
            tag.className = "violation-tag soft";
            tag.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${v}`;
            softBox.appendChild(tag);
        });
    }
}

function renderDataManagement() {
    const listClasses = document.getElementById("list-classes");
    listClasses.innerHTML = "";
    appData.classes.forEach(c => {
        const card = document.createElement("div");
        card.className = "entity-card";
        card.innerHTML = `
            <button class="delete-btn" onclick="deleteEntity('classes', '${c.id}')"><i class="fa-solid fa-trash"></i></button>
            <h4>${c.name} (${c.id})</h4>
            <p>Students: ${c.student_count}</p>
            <p>Subjects: ${c.subjects.join(", ")}</p>
        `;
        listClasses.appendChild(card);
    });

    const listTeachers = document.getElementById("list-teachers");
    listTeachers.innerHTML = "";
    appData.teachers.forEach(t => {
        const card = document.createElement("div");
        card.className = "entity-card";
        card.innerHTML = `
            <button class="delete-btn" onclick="deleteEntity('teachers', '${t.id}')"><i class="fa-solid fa-trash"></i></button>
            <h4>${t.name} (${t.id})</h4>
            <p>Max Hours/Day: ${t.max_hours_per_day}</p>
            <p>Teaches: ${t.subjects.join(", ")}</p>
        `;
        listTeachers.appendChild(card);
    });

    const listSubjects = document.getElementById("list-subjects");
    listSubjects.innerHTML = "";
    appData.subjects.forEach(s => {
        const card = document.createElement("div");
        card.className = "entity-card";
        card.innerHTML = `
            <button class="delete-btn" onclick="deleteEntity('subjects', '${s.id}')"><i class="fa-solid fa-trash"></i></button>
            <h4>${s.name} (${s.code})</h4>
            <p>Type: ${s.subject_type} | Weekly Hours: ${s.weekly_frequency}</p>
        `;
        listSubjects.appendChild(card);
    });

    const listRooms = document.getElementById("list-rooms");
    listRooms.innerHTML = "";
    appData.rooms.forEach(r => {
        const card = document.createElement("div");
        card.className = "entity-card";
        card.innerHTML = `
            <button class="delete-btn" onclick="deleteEntity('rooms', '${r.id}')"><i class="fa-solid fa-trash"></i></button>
            <h4>${r.name} (${r.id})</h4>
            <p>Type: ${r.room_type} | Capacity: ${r.capacity}</p>
        `;
        listRooms.appendChild(card);
    });
}

async function saveDataToServer() {
    try {
        await fetch("/api/data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(appData)
        });
    } catch (err) {}
}

async function addClass(e) {
    e.preventDefault();
    const id = document.getElementById("new-class-id").value;
    const name = document.getElementById("new-class-name").value;
    const count = parseInt(document.getElementById("new-class-count").value);
    const subjs = document.getElementById("new-class-subjects").value.split(",").map(s => s.trim()).filter(Boolean);

    appData.classes.push({ id, name, student_count: count, subjects: subjs });
    await saveDataToServer();
    closeModal("modal-class");
    renderDataManagement();
    populateTargetOptions();
}

async function addTeacher(e) {
    e.preventDefault();
    const id = document.getElementById("new-teacher-id").value;
    const name = document.getElementById("new-teacher-name").value;
    const maxH = parseInt(document.getElementById("new-teacher-max").value);
    const subjs = document.getElementById("new-teacher-subjects").value.split(",").map(s => s.trim()).filter(Boolean);

    appData.teachers.push({ id, name, max_hours_per_day: maxH, subjects: subjs });
    await saveDataToServer();
    closeModal("modal-teacher");
    renderDataManagement();
    populateTargetOptions();
}

async function addSubject(e) {
    e.preventDefault();
    const id = document.getElementById("new-subj-id").value;
    const name = document.getElementById("new-subj-name").value;
    const freq = parseInt(document.getElementById("new-subj-freq").value);
    const type = document.getElementById("new-subj-type").value;

    appData.subjects.push({ id, code: id, name, weekly_frequency: freq, subject_type: type });
    await saveDataToServer();
    closeModal("modal-subject");
    renderDataManagement();
}

async function addRoom(e) {
    e.preventDefault();
    const id = document.getElementById("new-room-id").value;
    const name = document.getElementById("new-room-name").value;
    const cap = parseInt(document.getElementById("new-room-cap").value);
    const type = document.getElementById("new-room-type").value;

    appData.rooms.push({ id, name, capacity: cap, room_type: type });
    await saveDataToServer();
    closeModal("modal-room");
    renderDataManagement();
    populateTargetOptions();
}

async function deleteEntity(type, id) {
    if (!confirm(`Delete ${type} item '${id}'?`)) return;
    appData[type] = appData[type].filter(item => item.id !== id);
    await saveDataToServer();
    renderDataManagement();
    populateTargetOptions();
}

function exportCSV() {
    if (!currentTimetable || currentTimetable.length === 0) {
        alert("No timetable to export!");
        return;
    }
    let csv = "Day,Period,Class,Subject,Teacher,Room\n";
    currentTimetable.forEach(g => {
        const pStr = appData.periods[g.period_idx] || `Period ${g.period_idx + 1}`;
        csv += `"${g.day}","${pStr}","${g.class_id}","${g.subject_id}","${g.teacher_id}","${g.room_id}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "timetable.csv";
    a.click();
}

function openModal(id) { document.getElementById(id).classList.add("active"); }
function closeModal(id) { document.getElementById(id).classList.remove("active"); }
function showLoading(show) {
    const el = document.getElementById("loading-overlay");
    if (show) el.classList.remove("hidden");
    else el.classList.add("hidden");
}
