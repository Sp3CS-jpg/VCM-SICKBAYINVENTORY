import os
import sqlite3
from functools import wraps
from datetime import datetime

from flask import Flask, flash, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

from config import DATABASE_PATH, SECRET_KEY, SESSION_TIMEOUT_MINUTES
from database import close_db, get_db, init_db, query

app = Flask(__name__)
app.config.update(
    SECRET_KEY=SECRET_KEY,
    DATABASE_PATH=str(DATABASE_PATH),
    PERMANENT_SESSION_LIFETIME=SESSION_TIMEOUT_MINUTES * 60,
)
app.teardown_appcontext(close_db)


def audit(action, entity_type, description, entity_id=None):
    db = get_db()
    db.execute(
        "INSERT INTO audit_logs (user_id,user_role,action,entity_type,entity_id,description,device_id) VALUES (?,?,?,?,?,?,?)",
        (
            session.get("user_id"),
            session.get("role"),
            action,
            entity_type,
            entity_id,
            description,
            os.environ.get("VCM_DEVICE_ID", "LOCAL"),
        ),
    )
    db.commit()


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("login"))
        return view(*args, **kwargs)

    return wrapped


def role_required(*roles):
    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            if session.get("role") not in roles:
                flash("You are not authorized to perform that action.", "error")
                return redirect(url_for("dashboard"))
            return view(*args, **kwargs)

        return wrapped

    return decorator


def ensure_seed_data():
    db = get_db()

    if not query("SELECT id FROM academic_sessions LIMIT 1", one=True):
        session_id = db.execute(
            "INSERT INTO academic_sessions (session_name, start_date, end_date, status) VALUES (?, ?, ?, 'ACTIVE')",
            ("2025/2026", "2025-09-01", "2026-07-31"),
        ).lastrowid

        terms = [
            ("First Term", "2025-09-01", "2025-12-15"),
            ("Second Term", "2026-01-05", "2026-03-31"),
            ("Third Term", "2026-04-01", "2026-07-31"),
        ]
        for term_name, start_date, end_date in terms:
            db.execute(
                "INSERT INTO terms (session_id, term_name, start_date, end_date) VALUES (?, ?, ?, ?)",
                (session_id, term_name, start_date, end_date),
            )

    if not query("SELECT id FROM users LIMIT 1", one=True):
        db.execute(
            "INSERT INTO users (username, full_name, password_hash, role) VALUES (?, ?, ?, ?)",
            (os.environ.get("VCM_ADMIN_USER", "principal"), "Principal", generate_password_hash(os.environ.get("VCM_ADMIN_PASSWORD", "change-me-now")), "PRINCIPAL"),
        )
        db.execute(
            "INSERT INTO users (username, full_name, password_hash, role) VALUES (?, ?, ?, ?)",
            (os.environ.get("VCM_NURSE_USER", "nurse"), "Nurse", generate_password_hash(os.environ.get("VCM_NURSE_PASSWORD", "change-me-now")), "NURSE"),
        )

    if not query("SELECT id FROM drugs LIMIT 1", one=True):
        drug_id = db.execute(
            "INSERT INTO drugs (drug_name, generic_name, strength, dosage_form, unit, minimum_stock_level) VALUES (?, ?, ?, ?, ?, ?)",
            ("Paracetamol", "Acetaminophen", "500mg", "Tablet", "tablet", 50),
        ).lastrowid
        batch_id = db.execute(
            "INSERT INTO drug_batches (drug_id, batch_number, quantity_received, quantity_remaining, expiry_date, date_received, supplier, received_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (drug_id, "PARA-001", 200, 200, "2027-12-31", "2025-09-01", "School Pharmacy", 1),
        ).lastrowid
        db.execute(
            "INSERT INTO drug_transactions (drug_id, batch_id, transaction_type, quantity, nurse_id, transaction_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (drug_id, batch_id, "RECEIVED", 200, 2, datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"), "Initial stock"),
        )

    db.commit()


@app.cli.command("init-db")
def initialize():
    init_db()
    with app.app_context():
        ensure_seed_data()
    print(f"Database initialized at {DATABASE_PATH}")


@app.route("/", methods=["GET", "POST"])
def login():
    if "user_id" in session:
        return redirect(url_for("dashboard"))

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        user = query("SELECT * FROM users WHERE username=? AND active=1", (username,), one=True)

        if user and check_password_hash(user["password_hash"], password):
            session.permanent = True
            session.update(user_id=user["id"], role=user["role"], full_name=user["full_name"])
            audit("LOGIN", "user", f"{user['full_name']} logged in", user["id"])
            return redirect(url_for("dashboard"))

        flash("Invalid username or password.", "error")

    return render_template("login.html")


@app.get("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.get("/dashboard")
@login_required
def dashboard():
    stats = {
        "students": query("SELECT COUNT(*) AS c FROM students WHERE status='ACTIVE'", one=True)["c"],
        "visits": query("SELECT COUNT(*) AS c FROM sickbay_visits", one=True)["c"],
        "today": query("SELECT COUNT(*) AS c FROM sickbay_visits WHERE date(visit_date)=date('now','localtime')", one=True)["c"],
        "low_stock": query("SELECT COUNT(*) AS c FROM drugs d LEFT JOIN (SELECT drug_id, SUM(quantity_remaining) AS qty FROM drug_batches GROUP BY drug_id) b ON b.drug_id=d.id WHERE COALESCE(b.qty,0) <= d.minimum_stock_level", one=True)["c"],
    }
    students = query("SELECT * FROM students ORDER BY updated_at DESC LIMIT 8")
    recent_visits = query("SELECT v.id, s.first_name, s.last_name, v.complaint, v.visit_date FROM sickbay_visits v JOIN students s ON s.id=v.student_id ORDER BY v.visit_date DESC LIMIT 8")
    active_session = query("SELECT session_name FROM academic_sessions WHERE status='ACTIVE' LIMIT 1", one=True)
    return render_template(
        "dashboard.html",
        stats=stats,
        students=students,
        recent_visits=recent_visits,
        active_session=active_session["session_name"] if active_session else "N/A",
        role=session["role"],
        full_name=session["full_name"],
    )


@app.route("/students", methods=["GET", "POST"])
@login_required
def students():
    if request.method == "POST":
        data = {
            "student_id": request.form.get("student_id", "").strip(),
            "first_name": request.form.get("first_name", "").strip(),
            "middle_name": request.form.get("middle_name", "").strip(),
            "last_name": request.form.get("last_name", "").strip(),
            "admission_number": request.form.get("admission_number", "").strip(),
            "current_class": request.form.get("current_class", "").strip(),
            "house": request.form.get("house", "").strip(),
            "status": request.form.get("status", "ACTIVE").strip(),
        }
        if not data["student_id"] or not data["first_name"] or not data["last_name"]:
            flash("Student ID, first name, and last name are required.", "error")
            return redirect(url_for("students"))

        try:
            db = get_db()
            cur = db.execute(
                "INSERT INTO students (student_id, first_name, middle_name, last_name, admission_number, current_class, house, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    data["student_id"],
                    data["first_name"],
                    data["middle_name"] or None,
                    data["last_name"],
                    data["admission_number"] or None,
                    data["current_class"] or None,
                    data["house"] or None,
                    data["status"],
                ),
            )
            db.commit()
            audit("CREATE", "student", f"Created student {data['first_name']} {data['last_name']}", cur.lastrowid)
            flash("Student saved locally.", "success")
        except sqlite3.IntegrityError:
            flash("A student with that ID or admission number already exists.", "error")
        return redirect(url_for("students"))

    rows = query(
        "SELECT s.*, COALESCE((SELECT class_name FROM enrollments e WHERE e.student_id=s.id ORDER BY e.created_at DESC LIMIT 1), s.current_class) AS latest_class FROM students s ORDER BY s.last_name, s.first_name"
    )
    return render_template("students.html", students=rows, role=session["role"], full_name=session["full_name"])


@app.route("/sessions", methods=["GET", "POST"])
@login_required
def sessions():
    if request.method == "POST":
        session_name = request.form.get("session_name", "").strip()
        start_date = request.form.get("start_date")
        end_date = request.form.get("end_date")
        if not session_name or not start_date or not end_date:
            flash("Session name, start date, and end date are required.", "error")
            return redirect(url_for("sessions"))

        db = get_db()
        try:
            sid = db.execute(
                "INSERT INTO academic_sessions (session_name, start_date, end_date, status) VALUES (?, ?, ?, 'ACTIVE')",
                (session_name, start_date, end_date),
            ).lastrowid
            for term_name, ts, te in [
                ("First Term", "", ""),
                ("Second Term", "", ""),
                ("Third Term", "", ""),
            ]:
                db.execute(
                    "INSERT INTO terms (session_id, term_name, start_date, end_date) VALUES (?, ?, ?, ?)",
                    (sid, term_name, ts or start_date, te or end_date),
                )
            db.commit()
            audit("CREATE", "academic_session", f"Created academic session {session_name}", sid)
            flash("Academic session created.", "success")
        except sqlite3.IntegrityError:
            flash("That session name already exists.", "error")
        return redirect(url_for("sessions"))

    rows = query(
        "SELECT s.*, (SELECT COUNT(*) FROM terms t WHERE t.session_id=s.id) AS term_count FROM academic_sessions s ORDER BY s.start_date DESC"
    )
    return render_template("sessions.html", sessions=rows, role=session["role"], full_name=session["full_name"])


@app.route("/visits", methods=["GET", "POST"])
@login_required
def visits():
    if request.method == "POST":
        student_id = request.form.get("student_id")
        session_id = request.form.get("session_id")
        term_id = request.form.get("term_id")
        complaint = request.form.get("complaint", "").strip()
        if not student_id or not complaint:
            flash("A student and complaint are required.", "error")
            return redirect(url_for("visits"))

        db = get_db()
        cur = db.execute(
            "INSERT INTO sickbay_visits (student_id, session_id, term_id, visit_date, complaint, symptoms, diagnosis, temperature, blood_pressure, pulse, treatment, notes, nurse_id, sent_home, reason_for_visit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                int(student_id),
                int(session_id) if session_id else None,
                int(term_id) if term_id else None,
                request.form.get("visit_date") or datetime.utcnow().strftime("%Y-%m-%d"),
                complaint,
                request.form.get("symptoms"),
                request.form.get("diagnosis"),
                request.form.get("temperature") or None,
                request.form.get("blood_pressure") or None,
                request.form.get("pulse") or None,
                request.form.get("treatment"),
                request.form.get("notes"),
                session.get("user_id"),
                1 if request.form.get("sent_home") == "on" else 0,
                request.form.get("reason_for_visit"),
            ),
        )
        db.commit()
        audit("CREATE", "sickbay_visit", f"Created sickbay visit for student ID {student_id}", cur.lastrowid)
        flash("Sickbay visit saved locally.", "success")
        return redirect(url_for("visits"))

    students = query("SELECT id, first_name, last_name, student_id FROM students ORDER BY last_name, first_name")
    sessions_rows = query("SELECT * FROM academic_sessions ORDER BY start_date DESC")
    terms_rows = query("SELECT * FROM terms ORDER BY session_id, id")
    visits_rows = query(
        "SELECT v.id, s.student_id, s.first_name, s.last_name, v.visit_date, v.complaint, v.diagnosis, v.sent_home FROM sickbay_visits v JOIN students s ON s.id=v.student_id ORDER BY v.visit_date DESC LIMIT 30"
    )
    return render_template("visits.html", students=students, sessions=sessions_rows, terms=terms_rows, visits=visits_rows, role=session["role"], full_name=session["full_name"])


@app.route("/inventory", methods=["GET", "POST"])
@login_required
def inventory():
    if request.method == "POST":
        action = request.form.get("action")
        if action == "add_drug":
            drug_name = request.form.get("drug_name", "").strip()
            if not drug_name:
                flash("Drug name is required.", "error")
                return redirect(url_for("inventory"))
            try:
                db = get_db()
                drug_id = db.execute(
                    "INSERT INTO drugs (drug_name, generic_name, strength, dosage_form, unit, minimum_stock_level) VALUES (?, ?, ?, ?, ?, ?)",
                    (drug_name, request.form.get("generic_name") or "", request.form.get("strength") or "", request.form.get("dosage_form") or "", request.form.get("unit") or "tablet", int(request.form.get("minimum_stock_level") or 0)),
                ).lastrowid
                db.commit()
                audit("CREATE", "drug", f"Created drug {drug_name}", drug_id)
                flash("Drug added.", "success")
            except sqlite3.IntegrityError:
                flash("That drug already exists.", "error")
            return redirect(url_for("inventory"))

        if action == "receive_stock":
            drug_id = request.form.get("drug_id")
            qty = request.form.get("quantity")
            batch_number = request.form.get("batch_number", "").strip()
            if not drug_id or not qty or not batch_number:
                flash("Drug, quantity, and batch number are required.", "error")
                return redirect(url_for("inventory"))

            db = get_db()
            batch_id = db.execute(
                "INSERT INTO drug_batches (drug_id, batch_number, quantity_received, quantity_remaining, expiry_date, date_received, supplier, received_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    int(drug_id),
                    batch_number,
                    int(qty),
                    int(qty),
                    request.form.get("expiry_date") or None,
                    request.form.get("date_received") or datetime.utcnow().strftime("%Y-%m-%d"),
                    request.form.get("supplier") or "Local Supplier",
                    session.get("user_id"),
                ),
            ).lastrowid
            db.execute(
                "INSERT INTO drug_transactions (drug_id, batch_id, transaction_type, quantity, nurse_id, transaction_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (int(drug_id), batch_id, "RECEIVED", int(qty), session.get("user_id"), datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"), "Stock received"),
            )
            db.commit()
            audit("RECEIVE", "drug", f"Received {qty} units into {batch_number}", int(drug_id))
            flash("Stock received and recorded.", "success")
            return redirect(url_for("inventory"))

    drugs = query(
        "SELECT d.id, d.drug_name, d.generic_name, d.unit, d.minimum_stock_level, COALESCE(SUM(b.quantity_remaining), 0) AS current_stock FROM drugs d LEFT JOIN drug_batches b ON b.drug_id = d.id GROUP BY d.id ORDER BY d.drug_name"
    )
    batches = query("SELECT b.*, d.drug_name FROM drug_batches b JOIN drugs d ON d.id=b.drug_id ORDER BY b.date_received DESC LIMIT 20")
    return render_template("inventory.html", drugs=drugs, batches=batches, role=session["role"], full_name=session["full_name"])


@app.route("/audit")
@login_required
def audit_logs():
    rows = query("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 50")
    return render_template("audit.html", logs=rows, role=session["role"], full_name=session["full_name"])


@app.route("/reports")
@login_required
def reports():
    yearly_visits = query("SELECT COUNT(*) AS total, strftime('%Y-%m', visit_date) AS month FROM sickbay_visits GROUP BY strftime('%Y-%m', visit_date) ORDER BY month DESC LIMIT 12")
    recent_students = query("SELECT COUNT(*) AS total FROM students WHERE status='ACTIVE'", one=True)["total"]
    summary = {
        "students": recent_students,
        "visits": query("SELECT COUNT(*) AS total FROM sickbay_visits", one=True)["total"],
        "drugs": query("SELECT COUNT(*) AS total FROM drugs", one=True)["total"],
    }
    return render_template("reports.html", summary=summary, yearly_visits=yearly_visits, role=session["role"], full_name=session["full_name"])


@app.get("/health")
def healthcheck():
    return {"status": "ok", "database": str(DATABASE_PATH)}, 200


@app.errorhandler(404)
def not_found(_error):
    return "Not found", 404


with app.app_context():
    init_db()
    ensure_seed_data()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", 5000)), debug=False)
