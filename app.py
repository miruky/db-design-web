import os
import sqlite3
import json
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DB_PATH = os.path.join(DB_DIR, "database.db")


def get_db():
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/execute", methods=["POST"])
def execute_sql():
    data = request.get_json()
    if not data or "sql" not in data:
        return jsonify({"error": "SQL文が必要です"}), 400

    sql = data["sql"].strip()
    if not sql:
        return jsonify({"error": "SQL文が空です"}), 400

    # Basic SQL injection prevention - only allow safe operations
    blocked = ["ATTACH", "DETACH", "LOAD_EXTENSION"]
    first_word = sql.split()[0].upper() if sql.split() else ""
    if first_word in blocked:
        return jsonify({"error": "この操作は許可されていません"}), 403

    conn = get_db()
    try:
        cursor = conn.cursor()

        # Handle multiple statements
        statements = [s.strip() for s in sql.split(";") if s.strip()]

        results = []
        for stmt in statements:
            cursor.execute(stmt)
            first_word = stmt.split()[0].upper() if stmt.split() else ""

            if first_word == "SELECT" or first_word == "PRAGMA":
                columns = [desc[0] for desc in cursor.description] if cursor.description else []
                rows = [dict(row) for row in cursor.fetchall()]
                results.append({
                    "type": "query",
                    "columns": columns,
                    "rows": rows,
                    "rowCount": len(rows),
                })
            else:
                results.append({
                    "type": "execute",
                    "message": f"実行完了: {cursor.rowcount} 行が影響を受けました",
                    "rowCount": cursor.rowcount,
                })

        conn.commit()
        return jsonify({"success": True, "results": results})

    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 400
    finally:
        conn.close()


@app.route("/api/tables", methods=["GET"])
def get_tables():
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = [row["name"] for row in cursor.fetchall()]

        table_info = []
        for table_name in tables:
            cursor.execute(f'PRAGMA table_info("{table_name}")')
            columns = [
                {
                    "cid": row["cid"],
                    "name": row["name"],
                    "type": row["type"],
                    "notnull": row["notnull"],
                    "pk": row["pk"],
                }
                for row in cursor.fetchall()
            ]
            cursor.execute(f'SELECT COUNT(*) as cnt FROM "{table_name}"')
            count = cursor.fetchone()["cnt"]

            table_info.append({
                "name": table_name,
                "columns": columns,
                "rowCount": count,
            })

        return jsonify({"tables": table_info})
    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 400
    finally:
        conn.close()


@app.route("/api/table/<table_name>", methods=["GET"])
def get_table_data(table_name):
    conn = get_db()
    try:
        cursor = conn.cursor()
        # Validate table exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table_name,),
        )
        if not cursor.fetchone():
            return jsonify({"error": f"テーブル '{table_name}' が見つかりません"}), 404

        cursor.execute(f'PRAGMA table_info("{table_name}")')
        columns = [row["name"] for row in cursor.fetchall()]

        cursor.execute(f'SELECT * FROM "{table_name}" LIMIT 500')
        rows = [dict(row) for row in cursor.fetchall()]

        return jsonify({"columns": columns, "rows": rows})
    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 400
    finally:
        conn.close()


if __name__ == "__main__":
    app.run(debug=True, port=5050)
