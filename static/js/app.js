/* ============================================
   DB Design Studio — Main Application Logic
   Browser-side SQLite via sql.js (WASM)
   ============================================ */

let db = null; // sql.js database instance

document.addEventListener("DOMContentLoaded", async () => {
    initTabs();
    initEditorLineNumbers();
    await initSQLiteWasm();
    initSQLite();
    initMarkdown();
    initMermaid();
    initPlantUML();
});

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
    mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        themeVariables: {
            mainBkg: "rgba(139, 92, 246, 0.15)",
            nodeBorder: "#8b5cf6",
            clusterBkg: "rgba(99, 102, 241, 0.08)",
            clusterBorder: "rgba(139, 92, 246, 0.3)",
            primaryTextColor: "#e9d5ff",
            secondaryTextColor: "#c4b5fd",
            tertiaryTextColor: "#a78bfa",
            lineColor: "#7c3aed",
            entityBorder: "#8b5cf6",
            entityBkg: "rgba(139, 92, 246, 0.12)",
            edgeLabelBackground: "rgba(15, 12, 30, 0.8)",
            classText: "#e9d5ff",
            actorBkg: "rgba(139, 92, 246, 0.20)",
            actorBorder: "#8b5cf6",
            actorTextColor: "#e9d5ff",
            signalColor: "#c4b5fd",
            signalTextColor: "#e9d5ff",
            noteBkgColor: "rgba(99, 102, 241, 0.15)",
            noteBorderColor: "#6366f1",
            noteTextColor: "#e9d5ff",
            activationBkgColor: "rgba(139, 92, 246, 0.20)",
            activationBorderColor: "#8b5cf6",
            labelBoxBkgColor: "rgba(15, 12, 30, 0.6)",
            labelBoxBorderColor: "#7c3aed",
            labelTextColor: "#e9d5ff",
            loopTextColor: "#c4b5fd",
            background: "transparent",
        },
        fontFamily: "'Inter', sans-serif",
        fontSize: 14,
        flowchart: { htmlLabels: true, curve: "basis", padding: 20 },
        er: { fontSize: 13, useMaxWidth: false },
        sequence: { useMaxWidth: false, actorMargin: 80, mirrorActors: true },
    });

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
                    showToast("PlantUML図をレンダリングしました", "success");
                })
                .catch(() => {
                    preview.innerHTML = `<div class="plantuml-output"><img src="${url}" alt="PlantUML Diagram" /></div>`;
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
    return svgText
        .replace(/<svg /, '<svg style="max-width:100%;height:auto;" ')
        .replace(/fill="#[A-Fa-f0-9]{6}"/g, (match) => {
            const c = match.match(/#[A-Fa-f0-9]{6}/)[0].toLowerCase();
            if (c === '#fefece' || c === '#ffffcc') return 'fill="rgba(139,92,246,0.12)"';
            if (c === '#ffffff' || c === '#fbfb77') return 'fill="rgba(15,12,30,0.6)"';
            if (c === '#000000') return 'fill="#e9d5ff"';
            if (c === '#a80036') return 'fill="#8b5cf6"';
            if (c === '#181818') return 'fill="#d8b4fe"';
            return match;
        })
        .replace(/stroke="#[A-Fa-f0-9]{6}"/g, (match) => {
            const c = match.match(/#[A-Fa-f0-9]{6}/)[0].toLowerCase();
            if (c === '#a80036') return 'stroke="#8b5cf6"';
            if (c === '#181818') return 'stroke="#7c3aed"';
            if (c === '#000000') return 'stroke="#6366f1"';
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

skinparam class {
    BackgroundColor #1a1025
    BorderColor #8b5cf6
    FontColor #e9d5ff
    ArrowColor #7c3aed
    AttributeFontColor #c4b5fd
    StereotypeFontColor #a78bfa
}

skinparam package {
    BackgroundColor #0f0c1e
    BorderColor #6366f1
    FontColor #c4b5fd
}

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
