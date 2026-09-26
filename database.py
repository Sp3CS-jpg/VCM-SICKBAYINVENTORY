import sqlite3
from pathlib import Path
from flask import current_app, g


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(current_app.config["DATABASE_PATH"])
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
        g.db.execute("PRAGMA journal_mode = WAL")
    return g.db


def close_db(_error=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = get_db()
    schema = Path(current_app.root_path, "database", "schema.sql").read_text(encoding="utf-8")
    db.executescript(schema)
    db.commit()


def query(sql, parameters=(), one=False):
    cursor = get_db().execute(sql, parameters)
    rows = cursor.fetchone() if one else cursor.fetchall()
    cursor.close()
    return rows
