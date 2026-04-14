/* ============================================
   DB Design Studio — Main Application Logic
   Browser-side SQLite via sql.js (WASM)
   ============================================ */

let db = null; // sql.js database instance

document.addEventListener("DOMContentLoaded", async () => {
    initThemePicker();
    initTabs();
    initEditorLineNumbers();
    await initSQLiteWasm();
    initSQLite();
    initMarkdown();
    initMermaid();
    initPlantUML();
    initPreviewActions();
});

/* ===========================================
   Theme System (Base + Accent Color)
   =========================================== */
const ACCENT_COLORS = [
    { name: "Purple",  h: 263, color: "#a855f7" },
    { name: "Violet",  h: 250, color: "#8b5cf6" },
    { name: "Indigo",  h: 234, color: "#6366f1" },
    { name: "Blue",    h: 217, color: "#3b82f6" },
    { name: "Cyan",    h: 188, color: "#06b6d4" },
    { name: "Teal",    h: 168, color: "#14b8a6" },
    { name: "Green",   h: 142, color: "#22c55e" },
    { name: "Lime",    h: 84,  color: "#84cc16" },
    { name: "Yellow",  h: 48,  color: "#eab308" },
    { name: "Amber",   h: 38,  color: "#f59e0b" },
    { name: "Orange",  h: 25,  color: "#f97316" },
    { name: "Red",     h: 0,   color: "#ef4444" },
    { name: "Rose",    h: 347, color: "#f43f5e" },
    { name: "Pink",    h: 330, color: "#ec4899" },
];

function initThemePicker() {
    const saved = JSON.parse(localStorage.getItem("dbds-theme") || "{}");
    const base = saved.base || "dark";
    const accentH = saved.accentH ?? 263;

    applyTheme(base, accentH, false);

    // Render accent swatches
    const swatchContainer = document.getElementById("accentSwatches");
    ACCENT_COLORS.forEach(({ name, h, color }) => {
        const el = document.createElement("div");
        el.className = "accent-swatch" + (h === accentH ? " active" : "");
        el.style.background = color;
        el.style.setProperty("--swatch-h", h);
        el.title = name;
        el.addEventListener("click", () => {
            swatchContainer.querySelectorAll(".accent-swatch").forEach(s => s.classList.remove("active"));
            el.classList.add("active");
            applyTheme(document.documentElement.getAttribute("data-base") || "dark", h, true);
        });
        swatchContainer.appendChild(el);
    });

    // Base toggle
    document.querySelectorAll(".base-toggle-btn").forEach(btn => {
        if (btn.dataset.base === base) btn.classList.add("active");
        else btn.classList.remove("active");
        btn.addEventListener("click", () => {
            document.querySelectorAll(".base-toggle-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const currentH = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--accent-h")) || 263;
            applyTheme(btn.dataset.base, currentH, true);
        });
    });

    // Dropdown toggle
    const pickerBtn = document.getElementById("themePickerBtn");
    const dropdown = document.getElementById("themeDropdown");
    pickerBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("open");
    });
    document.addEventListener("click", (e) => {
        if (!e.target.closest("#themePicker")) dropdown.classList.remove("open");
    });
}

function applyTheme(base, accentH, save) {
    document.documentElement.setAttribute("data-base", base);
    document.documentElement.style.setProperty("--accent-h", accentH);

    // Update logo gradient to match accent
    const logoGrad = document.getElementById("logoGrad");
    if (logoGrad) {
        const stops = logoGrad.querySelectorAll("stop");
        if (stops.length >= 2) {
            stops[0].setAttribute("stop-color", `hsl(${accentH}, 90%, 66%)`);
            stops[1].setAttribute("stop-color", `hsl(${(accentH - 23 + 360) % 360}, 84%, 67%)`);
        }
    }

    // Re-initialize Mermaid with new colors if already loaded
    if (typeof mermaid !== "undefined" && save) {
        initMermaidTheme(accentH, base);
    }

    if (save) {
        localStorage.setItem("dbds-theme", JSON.stringify({ base, accentH }));
        showToast("テーマを変更しました", "success");
    }
}

function initMermaidTheme(h, base) {
    const isDark = base === "dark";
    const textPrimary = isDark ? `hsl(${h}, 100%, 92%)` : `hsl(${h}, 50%, 20%)`;
    const textSecondary = isDark ? `hsl(${h}, 97%, 85%)` : `hsl(${h}, 45%, 30%)`;
    const textTertiary = isDark ? `hsl(${h}, 95%, 75%)` : `hsl(${h}, 40%, 40%)`;
    const accent = isDark ? `hsl(${h}, 90%, 66%)` : `hsl(${h}, 70%, 50%)`;
    const accentDark = isDark ? `hsl(${h}, 80%, 55%)` : `hsl(${h}, 65%, 42%)`;
    const accentBg = isDark ? `hsla(${h}, 90%, 66%, 0.15)` : `hsla(${h}, 70%, 50%, 0.10)`;
    const accentBgFaint = isDark ? `hsla(${h}, 84%, 67%, 0.08)` : `hsla(${h}, 60%, 50%, 0.06)`;
    const entityBg = isDark ? `hsla(${h}, 90%, 66%, 0.12)` : `hsla(${h}, 60%, 92%, 1)`;
    const labelBg = isDark ? "rgba(15, 12, 30, 0.8)" : "rgba(255, 255, 255, 0.92)";
    const bgColor = isDark ? "transparent" : "transparent";

    mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? "dark" : "default",
        themeVariables: {
            mainBkg: entityBg,
            nodeBorder: accent,
            clusterBkg: accentBgFaint,
            clusterBorder: `hsla(${h}, 90%, 66%, 0.3)`,
            primaryTextColor: textPrimary,
            secondaryTextColor: textSecondary,
            tertiaryTextColor: textTertiary,
            lineColor: accentDark,
            entityBorder: accent,
            entityBkg: entityBg,
            edgeLabelBackground: labelBg,
            classText: textPrimary,
            actorBkg: isDark ? `hsla(${h}, 90%, 66%, 0.20)` : `hsla(${h}, 60%, 50%, 0.12)`,
            actorBorder: accent,
            actorTextColor: textPrimary,
            signalColor: textSecondary,
            signalTextColor: textPrimary,
            noteBkgColor: isDark ? accentBgFaint : `hsla(${h}, 50%, 50%, 0.08)`,
            noteBorderColor: `hsl(${(h - 23 + 360) % 360}, 84%, ${isDark ? 67 : 50}%)`,
            noteTextColor: textPrimary,
            activationBkgColor: isDark ? `hsla(${h}, 90%, 66%, 0.20)` : `hsla(${h}, 60%, 50%, 0.12)`,
            activationBorderColor: accent,
            labelBoxBkgColor: labelBg,
            labelBoxBorderColor: accentDark,
            labelTextColor: textPrimary,
            loopTextColor: textSecondary,
            background: bgColor,
        },
        fontFamily: "'Inter', sans-serif",
        fontSize: 14,
        flowchart: { htmlLabels: true, curve: "basis", padding: 20 },
        er: { fontSize: 13, useMaxWidth: false },
        sequence: { useMaxWidth: false, actorMargin: 80, mirrorActors: true },
    });
}

/* ===========================================
   sql.js Initialization (WebAssembly SQLite)
   =========================================== */
async function initSQLiteWasm() {
    const statusEl = document.getElementById("dbStatus");
    statusEl.classList.add("loading");
    statusEl.querySelector(".status-text").textContent = "Loading...";

    try {
        const SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
        });
        db = new SQL.Database();
        statusEl.classList.remove("loading");
        statusEl.querySelector(".status-text").textContent = "Connected";
        showToast("SQLite (WASM) 初期化完了", "success");
    } catch (err) {
        statusEl.classList.remove("loading");
        statusEl.querySelector(".status-text").textContent = "Error";
        showToast("SQLite初期化エラー: " + err.message, "error");
    }
}

/* ===========================================
   Tab System
   =========================================== */
function initTabs() {
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    tabBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            tabBtns.forEach((b) => b.classList.remove("active"));
            tabContents.forEach((c) => c.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
        });
    });
}

/* ===========================================
   Editor Line Numbers
   =========================================== */
function initEditorLineNumbers() {
    const editors = [
        { editor: "sqlEditor", lines: "lineNumbers" },
        { editor: "mdEditor", lines: "mdLineNumbers" },
        { editor: "mermaidEditor", lines: "mermaidLineNumbers" },
        { editor: "plantumlEditor", lines: "plantumlLineNumbers" },
    ];

    editors.forEach(({ editor, lines }) => {
        const editorEl = document.getElementById(editor);
        const linesEl = document.getElementById(lines);
        if (!editorEl || !linesEl) return;

        const update = () => updateLineNumbers(editorEl, linesEl);
        editorEl.addEventListener("input", update);
        editorEl.addEventListener("scroll", () => { linesEl.scrollTop = editorEl.scrollTop; });
        editorEl.addEventListener("keydown", (e) => {
            if (e.key === "Tab") {
                e.preventDefault();
                const start = editorEl.selectionStart;
                const end = editorEl.selectionEnd;
                editorEl.value = editorEl.value.substring(0, start) + "    " + editorEl.value.substring(end);
                editorEl.selectionStart = editorEl.selectionEnd = start + 4;
                update();
            }
        });
        update();
    });
}

function updateLineNumbers(editor, linesEl) {
    const lineCount = editor.value.split("\n").length;
    const lines = [];
    for (let i = 1; i <= Math.max(lineCount, 12); i++) lines.push(i);
    linesEl.textContent = lines.join("\n");
}

/* ===========================================
   SQLite Functions (browser-side via sql.js)
   =========================================== */
function initSQLite() {
    const btnExecute = document.getElementById("btnExecute");
    const btnLoadSample = document.getElementById("btnLoadSample");
    const btnRefreshTables = document.getElementById("btnRefreshTables");
    const sqlEditor = document.getElementById("sqlEditor");

    sqlEditor.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            executeSQL();
        }
    });

    btnExecute.addEventListener("click", executeSQL);
    btnLoadSample.addEventListener("click", loadSampleSQL);
    btnRefreshTables.addEventListener("click", refreshTables);
    refreshTables();
}

function executeSQL() {
    if (!db) {
        showToast("SQLiteが初期化されていません", "error");
        return;
    }

    const editor = document.getElementById("sqlEditor");
    const sql = editor.value.trim();
    if (!sql) {
        showToast("SQL文を入力してください", "error");
        return;
    }

    const resultsEl = document.getElementById("sqlResults");

    try {
        // Split into statements
        const statements = sql.split(";").map(s => s.trim()).filter(s => s.length > 0);
        let html = "";

        statements.forEach((stmt, index) => {
            html += `<div class="result-block" style="animation-delay: ${index * 80}ms">`;
            const firstWord = stmt.split(/\s+/)[0].toUpperCase();

            if (firstWord === "SELECT" || firstWord === "PRAGMA") {
                try {
                    const results = db.exec(stmt);
                    if (results.length > 0) {
                        const res = results[0];
                        html += renderResultTable(res.columns, res.values);
                        html += `<div class="result-meta">
                            <span class="badge">${res.values.length} 行</span>
                            <span class="badge">${res.columns.length} カラム</span>
                        </div>`;
                    } else {
                        html += `<div class="result-message">クエリは結果を返しませんでした</div>`;
                    }
                } catch (err) {
                    html += `<div class="result-error">${escapeHtml(err.message)}</div>`;
                }
            } else {
                try {
                    db.run(stmt);
                    const changes = db.getRowsModified();
                    html += `<div class="result-message">実行完了: ${changes} 行が影響を受けました</div>`;
                } catch (err) {
                    html += `<div class="result-error">${escapeHtml(err.message)}</div>`;
                }
            }
            html += "</div>";
        });

        resultsEl.innerHTML = html;
        showDownloadButton("btnDownloadSql");
        showToast("実行完了", "success");
        refreshTables();
    } catch (err) {
        resultsEl.innerHTML = `<div class="result-error">${escapeHtml(err.message)}</div>`;
        showToast("エラーが発生しました", "error");
    }
}

function renderResultTable(columns, rows) {
    let html = '<div class="result-table-wrapper"><table class="result-table">';
    html += "<thead><tr>";
    columns.forEach((col) => {
        html += `<th>${escapeHtml(col)}</th>`;
    });
    html += "</tr></thead><tbody>";

    rows.forEach((row) => {
        html += "<tr>";
        row.forEach((val) => {
            if (val === null || val === undefined) {
                html += `<td><span class="null-value">NULL</span></td>`;
            } else {
                html += `<td>${escapeHtml(String(val))}</td>`;
            }
        });
        html += "</tr>";
    });

    html += "</tbody></table></div>";
    return html;
}

function refreshTables() {
    if (!db) return;
    const listEl = document.getElementById("tableList");

    try {
        const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");

        if (!tables.length || !tables[0].values.length) {
            listEl.innerHTML = '<div class="empty-state small"><p>テーブルがありません</p></div>';
            return;
        }

        let html = "";
        tables[0].values.forEach(([tableName]) => {
            const colInfo = db.exec(`PRAGMA table_info("${tableName}")`);
            const countRes = db.exec(`SELECT COUNT(*) FROM "${tableName}"`);
            const rowCount = countRes.length ? countRes[0].values[0][0] : 0;

            html += `<div class="table-card" onclick="viewTable('${escapeHtml(tableName)}')">`;
            html += `<div class="table-card-header">`;
            html += `<span class="table-card-name">${escapeHtml(tableName)}</span>`;
            html += `<span class="table-card-count">${rowCount} rows</span>`;
            html += `</div><div class="table-card-columns">`;

            if (colInfo.length) {
                colInfo[0].values.forEach((col) => {
                    const name = col[1];
                    const type = col[2] || "ANY";
                    const pk = col[5];
                    const pkClass = pk ? " pk" : "";
                    html += `<span class="column-tag${pkClass}">${escapeHtml(name)} <span class="col-type">${escapeHtml(type)}</span></span>`;
                });
            }
            html += `</div></div>`;
        });

        listEl.innerHTML = html;
    } catch (err) {
        listEl.innerHTML = '<div class="empty-state small"><p>テーブルの読み込みに失敗しました</p></div>';
    }
}

function viewTable(name) {
    const editor = document.getElementById("sqlEditor");
    editor.value = `SELECT * FROM "${name}"`;
    updateLineNumbers(editor, document.getElementById("lineNumbers"));
    executeSQL();
}

function loadSampleSQL() {
    const editor = document.getElementById("sqlEditor");
    editor.value = `-- サンプル: ユーザー管理データベース
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'user',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    owner_id INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    project_id INTEGER NOT NULL,
    assignee_id INTEGER,
    priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'critical')),
    status TEXT DEFAULT 'todo',
    due_date TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (assignee_id) REFERENCES users(id)
);

INSERT OR IGNORE INTO users (name, email, role) VALUES
    ('田中 太郎', 'tanaka@example.com', 'admin'),
    ('佐藤 花子', 'sato@example.com', 'developer'),
    ('鈴木 一郎', 'suzuki@example.com', 'designer'),
    ('高橋 美咲', 'takahashi@example.com', 'developer'),
    ('伊藤 健太', 'ito@example.com', 'manager');

INSERT OR IGNORE INTO projects (name, description, owner_id, status) VALUES
    ('DB Design Studio', 'データベース設計ツール', 1, 'active'),
    ('Mobile App', 'モバイルアプリ開発', 2, 'active'),
    ('Analytics Dashboard', '分析ダッシュボード', 5, 'planning');

INSERT OR IGNORE INTO tasks (title, project_id, assignee_id, priority, status, due_date) VALUES
    ('スキーマ設計', 1, 1, 'high', 'in_progress', '2026-04-20'),
    ('UI実装', 1, 3, 'medium', 'todo', '2026-04-25'),
    ('API開発', 2, 2, 'critical', 'in_progress', '2026-04-18'),
    ('テスト作成', 2, 4, 'high', 'todo', '2026-04-22'),
    ('要件定義', 3, 5, 'medium', 'done', '2026-04-10')`;

    updateLineNumbers(editor, document.getElementById("lineNumbers"));
    showToast("サンプルSQLを読み込みました", "success");
}

/* ===========================================
   Markdown Functions
   =========================================== */
function initMarkdown() {
    document.getElementById("btnRenderMd").addEventListener("click", renderMarkdown);
    document.getElementById("btnMdSample").addEventListener("click", loadSampleMarkdown);
    document.getElementById("mdEditor").addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); renderMarkdown(); }
    });
}

function renderMarkdown() {
    const editor = document.getElementById("mdEditor");
    const preview = document.getElementById("mdPreview");
    const md = editor.value.trim();
    if (!md) { showToast("Markdownを入力してください", "error"); return; }
    try {
        preview.innerHTML = marked.parse(md);
        showDownloadButton("btnDownloadMd");
        showToast("レンダリング完了", "success");
    } catch (err) {
        preview.innerHTML = `<div class="result-error">パースエラー: ${escapeHtml(err.message)}</div>`;
    }
}

function loadSampleMarkdown() {
    const editor = document.getElementById("mdEditor");
    editor.value = `# データベース設計書

## ユーザーテーブル (users)

| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | ユーザーID |
| name | TEXT | NOT NULL | ユーザー名 |
| email | TEXT | UNIQUE, NOT NULL | メールアドレス |
| role | TEXT | DEFAULT 'user' | ロール |
| created_at | TEXT | DEFAULT datetime('now') | 作成日時 |

## プロジェクトテーブル (projects)

| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | プロジェクトID |
| name | TEXT | NOT NULL | プロジェクト名 |
| description | TEXT | — | 説明 |
| owner_id | INTEGER | FK → users(id) | オーナー |
| status | TEXT | DEFAULT 'active' | ステータス |
| created_at | TEXT | DEFAULT datetime('now') | 作成日時 |

## タスクテーブル (tasks)

| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | タスクID |
| title | TEXT | NOT NULL | タイトル |
| project_id | INTEGER | FK → projects(id) | プロジェクト |
| assignee_id | INTEGER | FK → users(id) | 担当者 |
| priority | TEXT | CHECK(low/medium/high/critical) | 優先度 |
| status | TEXT | DEFAULT 'todo' | ステータス |
| due_date | TEXT | — | 期限 |

---

## ER図の概要

- **users** ←(1:N)→ **projects** : オーナーが複数プロジェクトを持つ
- **projects** ←(1:N)→ **tasks** : プロジェクトに複数タスクが紐づく
- **users** ←(1:N)→ **tasks** : ユーザーに複数タスクがアサインされる

> 全テーブルで \`created_at\` を自動設定し、監査ログに活用`;
    updateLineNumbers(editor, document.getElementById("mdLineNumbers"));
    showToast("サンプルMarkdownを読み込みました", "success");
}

/* ===========================================
   Mermaid Functions
   =========================================== */
function initMermaid() {
    const saved = JSON.parse(localStorage.getItem("dbds-theme") || "{}");
    const h = saved.accentH ?? 263;
    const base = saved.base || "dark";
    initMermaidTheme(h, base);

    document.getElementById("btnRenderMermaid").addEventListener("click", renderMermaid);
    document.getElementById("btnMermaidSample").addEventListener("click", loadSampleMermaid);
    document.getElementById("mermaidEditor").addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); renderMermaid(); }
    });
}

let mermaidCounter = 0;

async function renderMermaid() {
    const editor = document.getElementById("mermaidEditor");
    const preview = document.getElementById("mermaidPreview");
    const code = editor.value.trim();
    if (!code) { showToast("Mermaid記法を入力してください", "error"); return; }

    preview.innerHTML = '<div class="empty-state"><div class="spinner"></div><p>レンダリング中...</p></div>';

    try {
        mermaidCounter++;
        const { svg } = await mermaid.render(`mermaid-svg-${mermaidCounter}`, code);
        preview.innerHTML = `<div class="mermaid-output">${svg}</div>`;
        const svgEl = preview.querySelector("svg");
        if (svgEl) {
            svgEl.style.maxWidth = "100%";
            svgEl.style.height = "auto";
        }
        showDownloadButton("btnDownloadMermaid");
        showToast("Mermaid図をレンダリングしました", "success");
    } catch (err) {
        preview.innerHTML = `<div class="result-error" style="margin:20px">構文エラー: ${escapeHtml(err.message || "不正なMermaid記法です")}</div>`;
        showToast("Mermaidの構文エラー", "error");
    }
}

function loadSampleMermaid() {
    const editor = document.getElementById("mermaidEditor");
    editor.value = `erDiagram
    USERS {
        int id PK
        string name
        string email
        string role
        datetime created_at
    }
    PROJECTS {
        int id PK
        string name
        string description
        int owner_id FK
        string status
        datetime created_at
    }
    TASKS {
        int id PK
        string title
        int project_id FK
        int assignee_id FK
        string priority
        string status
        date due_date
    }

    USERS ||--o{ PROJECTS : "owns"
    USERS ||--o{ TASKS : "assigned to"
    PROJECTS ||--o{ TASKS : "contains"`;
    updateLineNumbers(editor, document.getElementById("mermaidLineNumbers"));
    showToast("サンプルMermaid図を読み込みました", "success");
}

/* ===========================================
   PlantUML Functions
   =========================================== */
function initPlantUML() {
    document.getElementById("btnRenderPlantUML").addEventListener("click", renderPlantUML);
    document.getElementById("btnPlantUMLSample").addEventListener("click", loadSamplePlantUML);
    document.getElementById("plantumlEditor").addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); renderPlantUML(); }
    });
}

function renderPlantUML() {
    const editor = document.getElementById("plantumlEditor");
    const preview = document.getElementById("plantumlPreview");
    const code = editor.value.trim();
    if (!code) { showToast("PlantUML記法を入力してください", "error"); return; }

    preview.innerHTML = '<div class="empty-state"><div class="spinner"></div><p>レンダリング中...</p></div>';

    try {
        const encoded = plantumlEncode(code);
        const url = `https://www.plantuml.com/plantuml/svg/${encoded}`;
        const img = new Image();
        img.onload = () => {
            fetch(url)
                .then(res => res.text())
                .then(svgText => {
                    preview.innerHTML = `<div class="plantuml-output">${stylePlantUMLSvg(svgText)}</div>`;
                    showDownloadButton("btnDownloadPlantUML");
                    showToast("PlantUML図をレンダリングしました", "success");
                })
                .catch(() => {
                    preview.innerHTML = `<div class="plantuml-output"><img src="${url}" alt="PlantUML Diagram" /></div>`;
                    showDownloadButton("btnDownloadPlantUML");
                    showToast("PlantUML図をレンダリングしました", "success");
                });
        };
        img.onerror = () => {
            preview.innerHTML = `<div class="result-error" style="margin:20px">レンダリングエラー: PlantUML構文を確認してください</div>`;
            showToast("PlantUMLのエラー", "error");
        };
        img.src = url;
    } catch (err) {
        preview.innerHTML = `<div class="result-error" style="margin:20px">エンコードエラー: ${escapeHtml(err.message)}</div>`;
    }
}

function stylePlantUMLSvg(svgText) {
    const h = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--accent-h")) || 263;
    const isDark = (document.documentElement.getAttribute("data-base") || "dark") === "dark";

    const accentFill = isDark ? `hsl(${h}, 90%, 66%)` : `hsl(${h}, 70%, 50%)`;
    const accentStroke = isDark ? `hsl(${h}, 80%, 55%)` : `hsl(${h}, 65%, 42%)`;
    const textColor = isDark ? `hsl(${h}, 100%, 92%)` : `hsl(${h}, 50%, 20%)`;
    const textMid = isDark ? `hsl(${h}, 97%, 85%)` : `hsl(${h}, 45%, 30%)`;
    const entityBg = isDark ? `hsla(${h},90%,66%,0.12)` : `hsla(${h},60%,92%,1)`;
    const packageBg = isDark ? `hsla(${h},20%,10%,0.6)` : `hsla(${h},50%,96%,1)`;
    const ac2Stroke = isDark ? `hsl(${(h - 23 + 360) % 360}, 84%, 67%)` : `hsl(${(h - 23 + 360) % 360}, 60%, 50%)`;

    // Dark-theme entity/package colors from the sample that need replacing
    const darkEntityColors = ['#1a1025', '#1a1026', '#1b1025'];
    const darkPackageColors = ['#0f0c1e', '#0f0c1f', '#100c1e'];
    const darkTextColors = ['#e9d5ff', '#c4b5fd', '#a78bfa'];
    const darkBorderColors = ['#8b5cf6', '#6366f1', '#7c3aed'];

    return svgText
        .replace(/<svg /, '<svg style="max-width:100%;height:auto;" ')
        .replace(/fill="#[A-Fa-f0-9]{3,6}"/g, (match) => {
            const c = match.match(/#[A-Fa-f0-9]{3,6}/)[0].toLowerCase();
            // Default PlantUML colors
            if (c === '#fefece' || c === '#ffffcc') return `fill="${entityBg}"`;
            if (c === '#ffffff' || c === '#fbfb77') return `fill="${packageBg}"`;
            if (c === '#000000') return `fill="${textColor}"`;
            if (c === '#a80036') return `fill="${accentFill}"`;
            if (c === '#181818') return `fill="${textMid}"`;
            // Custom dark-theme colors from sample
            if (darkEntityColors.includes(c)) return `fill="${entityBg}"`;
            if (darkPackageColors.includes(c)) return `fill="${packageBg}"`;
            if (darkTextColors.includes(c)) return `fill="${textColor}"`;
            if (darkBorderColors.includes(c)) return `fill="${accentFill}"`;
            return match;
        })
        .replace(/stroke="#[A-Fa-f0-9]{3,6}"/g, (match) => {
            const c = match.match(/#[A-Fa-f0-9]{3,6}/)[0].toLowerCase();
            if (c === '#a80036') return `stroke="${accentFill}"`;
            if (c === '#181818') return `stroke="${accentStroke}"`;
            if (c === '#000000') return `stroke="${ac2Stroke}"`;
            if (darkBorderColors.includes(c)) return `stroke="${accentStroke}"`;
            return match;
        })
        .replace(/fill="#[A-Fa-f0-9]{3,6}"/g, (match) => {
            // Second pass — aggressive: replace any remaining dark fills in light mode
            if (!isDark) {
                const c = match.match(/#[A-Fa-f0-9]{3,6}/)[0].toLowerCase();
                // If it's a very dark color used as background, lighten it
                const r = parseInt(c.slice(1,3), 16) || 0;
                const g = parseInt(c.slice(3,5), 16) || 0;
                const b = parseInt(c.slice(5,7), 16) || 0;
                const lum = (r * 299 + g * 587 + b * 114) / 1000;
                if (lum < 40) return `fill="${entityBg}"`;
            }
            return match;
        });
}

function loadSamplePlantUML() {
    const editor = document.getElementById("plantumlEditor");
    editor.value = `@startuml
!theme plain

skinparam backgroundColor transparent
skinparam roundcorner 12
skinparam shadowing false
skinparam defaultFontName Inter
skinparam defaultFontSize 13

package "ユーザー管理" {
    entity "users" as users {
        * **id** : INTEGER <<PK>>
        --
        * name : TEXT
        * email : TEXT <<UNIQUE>>
        role : TEXT
        created_at : TEXT
    }
}

package "プロジェクト管理" {
    entity "projects" as projects {
        * **id** : INTEGER <<PK>>
        --
        * name : TEXT
        description : TEXT
        * owner_id : INTEGER <<FK>>
        status : TEXT
        created_at : TEXT
    }

    entity "tasks" as tasks {
        * **id** : INTEGER <<PK>>
        --
        * title : TEXT
        * project_id : INTEGER <<FK>>
        assignee_id : INTEGER <<FK>>
        priority : TEXT
        status : TEXT
        due_date : TEXT
    }
}

users ||--o{ projects : "1:N owns"
users ||--o{ tasks : "1:N assigned"
projects ||--o{ tasks : "1:N contains"
@enduml`;
    updateLineNumbers(editor, document.getElementById("plantumlLineNumbers"));
    showToast("サンプルPlantUMLを読み込みました", "success");
}

/* ===========================================
   PlantUML Encoding (deflate → base64url)
   =========================================== */
function plantumlEncode(text) {
    const data = unescape(encodeURIComponent(text));
    const compressed = rawDeflate(data);
    return encode64(compressed);
}

function encode64(data) {
    let r = "";
    for (let i = 0; i < data.length; i += 3) {
        if (i + 2 === data.length) r += append3bytes(data.charCodeAt(i), data.charCodeAt(i + 1), 0);
        else if (i + 1 === data.length) r += append3bytes(data.charCodeAt(i), 0, 0);
        else r += append3bytes(data.charCodeAt(i), data.charCodeAt(i + 1), data.charCodeAt(i + 2));
    }
    return r;
}

function append3bytes(b1, b2, b3) {
    const c1 = b1 >> 2, c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
    const c3 = ((b2 & 0xf) << 2) | (b3 >> 6), c4 = b3 & 0x3f;
    return encode6bit(c1 & 0x3f) + encode6bit(c2 & 0x3f) + encode6bit(c3 & 0x3f) + encode6bit(c4 & 0x3f);
}

function encode6bit(b) {
    if (b < 10) return String.fromCharCode(48 + b);
    b -= 10; if (b < 26) return String.fromCharCode(65 + b);
    b -= 26; if (b < 26) return String.fromCharCode(97 + b);
    b -= 26; if (b === 0) return "-"; if (b === 1) return "_"; return "?";
}

function rawDeflate(data) {
    const bytes = [];
    for (let i = 0; i < data.length; i++) bytes.push(data.charCodeAt(i));
    const uint8 = new Uint8Array(bytes);
    if (typeof window.pako !== 'undefined') {
        const compressed = window.pako.deflateRaw(uint8, { level: 9 });
        let result = '';
        for (let i = 0; i < compressed.length; i++) result += String.fromCharCode(compressed[i]);
        return result;
    }
    // Fallback: stored blocks
    const result = [];
    let pos = 0;
    while (pos < bytes.length) {
        const remaining = bytes.length - pos;
        const blockSize = Math.min(remaining, 65535);
        const isFinal = (pos + blockSize >= bytes.length) ? 1 : 0;
        result.push(isFinal, blockSize & 0xff, (blockSize >> 8) & 0xff, ~blockSize & 0xff, (~blockSize >> 8) & 0xff);
        for (let i = 0; i < blockSize; i++) result.push(bytes[pos + i]);
        pos += blockSize;
    }
    return String.fromCharCode.apply(null, result);
}

/* ===========================================
   Utilities
   =========================================== */
function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    const iconSvg = type === "success"
        ? '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
        : '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = "toastOut 0.3s ease forwards";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/* ===========================================
   Result Table Expand (Click to Zoom)
   =========================================== */
function expandTableWrapper(wrapper) {
    const backdrop = document.createElement("div");
    backdrop.className = "expand-backdrop";
    backdrop.addEventListener("click", () => collapseTableWrapper(wrapper));
    document.body.appendChild(backdrop);

    // Move wrapper to body to escape backdrop-filter stacking context
    wrapper._origParent = wrapper.parentNode;
    wrapper._origNextSibling = wrapper.nextSibling;
    document.body.appendChild(wrapper);

    wrapper._expandBackdrop = backdrop;
    wrapper.classList.add("expanded");

    const escHandler = (e) => {
        if (e.key === "Escape") { collapseTableWrapper(wrapper); document.removeEventListener("keydown", escHandler); }
    };
    wrapper._escHandler = escHandler;
    document.addEventListener("keydown", escHandler);
}

function collapseTableWrapper(wrapper) {
    wrapper.classList.remove("expanded");
    // Move wrapper back to original parent
    if (wrapper._origParent) {
        if (wrapper._origNextSibling) {
            wrapper._origParent.insertBefore(wrapper, wrapper._origNextSibling);
        } else {
            wrapper._origParent.appendChild(wrapper);
        }
        wrapper._origParent = null;
        wrapper._origNextSibling = null;
    }
    if (wrapper._expandBackdrop) {
        wrapper._expandBackdrop.remove();
        wrapper._expandBackdrop = null;
    }
    if (wrapper._escHandler) {
        document.removeEventListener("keydown", wrapper._escHandler);
        wrapper._escHandler = null;
    }
}

/* ===========================================
   Preview Download & Expand
   =========================================== */
function initPreviewActions() {
    // Download buttons
    document.getElementById("btnDownloadSql").addEventListener("click", () => downloadPreviewAsImage("sqlResults", "sql-result"));
    document.getElementById("btnDownloadMd").addEventListener("click", () => downloadPreviewAsImage("mdPreview", "markdown-preview"));
    document.getElementById("btnDownloadMermaid").addEventListener("click", () => downloadSvgAsImage("mermaidPreview", "mermaid-diagram"));
    document.getElementById("btnDownloadPlantUML").addEventListener("click", () => downloadSvgAsImage("plantumlPreview", "plantuml-diagram"));

    // Click-to-expand for diagram & markdown previews
    ["mermaidPreview", "plantumlPreview", "mdPreview"].forEach(id => {
        const panel = document.getElementById(id);
        panel.addEventListener("click", (e) => {
            if (e.target.closest(".empty-state") || e.target.closest(".result-error")) return;
            if (panel.querySelector(".empty-state")) return;
            const hasContent = panel.querySelector(".mermaid-output, .plantuml-output, table, h1, h2, h3, p, ul, ol, img");
            if (!hasContent) return;
            expandPreview(panel);
        });
    });

    // Also handle expand for SQL result tables with the same pattern
    const sqlResults = document.getElementById("sqlResults");
    sqlResults.addEventListener("click", (e) => {
        const wrapper = e.target.closest(".result-table-wrapper");
        if (!wrapper) return;
        if (wrapper.classList.contains("expanded")) {
            collapseTableWrapper(wrapper);
        } else {
            expandTableWrapper(wrapper);
        }
    });
}

function showDownloadButton(btnId) {
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.remove("hidden");
}

function downloadSvgAsImage(containerId, filename) {
    const container = document.getElementById(containerId);
    const svgEl = container.querySelector("svg");
    if (!svgEl) { showToast("ダウンロードする図がありません", "error"); return; }

    const clone = svgEl.cloneNode(true);
    // Inline computed styles for faithful rendering
    inlineSvgStyles(svgEl, clone);

    const svgData = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
        const scale = 2;
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth * scale;
        canvas.height = img.naturalHeight * scale;
        const ctx = canvas.getContext("2d");

        // Draw background matching the current theme
        const isDark = (document.documentElement.getAttribute("data-base") || "dark") === "dark";
        ctx.fillStyle = isDark ? "#0a0814" : "#f8f7fc";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        canvas.toBlob((blob) => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `${filename}-${Date.now()}.png`;
            a.click();
            URL.revokeObjectURL(a.href);
            showToast("画像をダウンロードしました", "success");
        }, "image/png");
    };
    img.onerror = () => {
        URL.revokeObjectURL(url);
        showToast("画像の生成に失敗しました", "error");
    };
    img.src = url;
}

function inlineSvgStyles(source, target) {
    const sourceChildren = source.children;
    const targetChildren = target.children;
    for (let i = 0; i < sourceChildren.length; i++) {
        if (targetChildren[i]) {
            const computed = window.getComputedStyle(sourceChildren[i]);
            const important = ["fill", "stroke", "stroke-width", "font-family", "font-size", "font-weight", "color", "opacity", "visibility"];
            important.forEach(prop => {
                const val = computed.getPropertyValue(prop);
                if (val) targetChildren[i].style.setProperty(prop, val);
            });
            inlineSvgStyles(sourceChildren[i], targetChildren[i]);
        }
    }
}

function downloadPreviewAsImage(containerId, filename) {
    const container = document.getElementById(containerId);
    if (!container || container.querySelector(".empty-state")) {
        showToast("ダウンロードするコンテンツがありません", "error");
        return;
    }

    // For SQL results, capture the full table including scrolled-out parts
    let target = container;
    const tableWrapper = container.querySelector(".result-table-wrapper");
    const tableEl = container.querySelector(".result-table");
    if (tableEl && tableWrapper) {
        // Temporarily remove overflow clip so html2canvas sees full table
        const origOverflow = tableWrapper.style.overflow;
        const origMaxWidth = tableWrapper.style.maxWidth;
        tableWrapper.style.overflow = "visible";
        tableWrapper.style.maxWidth = "none";
        target = tableEl;

        const isDark = (document.documentElement.getAttribute("data-base") || "dark") === "dark";
        html2canvas(target, {
            backgroundColor: isDark ? "#0a0814" : "#f8f7fc",
            scale: 2,
            useCORS: true,
            logging: false,
            windowWidth: tableEl.scrollWidth + 40,
        }).then(canvas => {
            tableWrapper.style.overflow = origOverflow;
            tableWrapper.style.maxWidth = origMaxWidth;
            canvas.toBlob((blob) => {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `${filename}-${Date.now()}.png`;
                a.click();
                URL.revokeObjectURL(a.href);
                showToast("画像をダウンロードしました", "success");
            }, "image/png");
        }).catch(() => {
            tableWrapper.style.overflow = origOverflow;
            tableWrapper.style.maxWidth = origMaxWidth;
            showToast("画像の生成に失敗しました", "error");
        });
        return;
    }

    const isDark = (document.documentElement.getAttribute("data-base") || "dark") === "dark";
    html2canvas(target, {
        backgroundColor: isDark ? "#0a0814" : "#f8f7fc",
        scale: 2,
        useCORS: true,
        logging: false,
    }).then(canvas => {
        canvas.toBlob((blob) => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `${filename}-${Date.now()}.png`;
            a.click();
            URL.revokeObjectURL(a.href);
            showToast("画像をダウンロードしました", "success");
        }, "image/png");
    }).catch(() => {
        showToast("画像の生成に失敗しました", "error");
    });
}

function expandPreview(panel) {
    const backdrop = document.createElement("div");
    backdrop.className = "expand-backdrop";
    document.body.appendChild(backdrop);

    // Clone content into an overlay to escape backdrop-filter stacking context
    const overlay = document.createElement("div");
    overlay.className = "preview-expanded-overlay";
    // Copy classes from panel so CSS selectors like .markdown-preview still work
    panel.classList.forEach(cls => {
        if (cls !== "panel-body") overlay.classList.add(cls);
    });
    overlay.innerHTML = panel.innerHTML;
    document.body.appendChild(overlay);

    panel._expandBackdrop = backdrop;
    panel._expandOverlay = overlay;

    const closeExpand = () => {
        overlay.remove();
        backdrop.remove();
        panel._expandBackdrop = null;
        panel._expandOverlay = null;
        if (panel._escHandler) {
            document.removeEventListener("keydown", panel._escHandler);
            panel._escHandler = null;
        }
    };

    backdrop.addEventListener("click", closeExpand);
    overlay.addEventListener("click", closeExpand);

    const escHandler = (e) => {
        if (e.key === "Escape") closeExpand();
    };
    panel._escHandler = escHandler;
    document.addEventListener("keydown", escHandler);
}

function collapsePreview(panel) {
    if (panel._expandOverlay) {
        panel._expandOverlay.remove();
        panel._expandOverlay = null;
    }
    if (panel._expandBackdrop) {
        panel._expandBackdrop.remove();
        panel._expandBackdrop = null;
    }
    if (panel._escHandler) {
        document.removeEventListener("keydown", panel._escHandler);
        panel._escHandler = null;
    }
}
