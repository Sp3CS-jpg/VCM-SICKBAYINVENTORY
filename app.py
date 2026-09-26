import os
import sqlite3
from functools import wraps
from flask import Flask, flash, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash
from config import DATABASE_PATH, SECRET_KEY, SESSION_TIMEOUT_MINUTES
from database import close_db, get_db, init_db, query

app = Flask(__name__)
app.config.update(SECRET_KEY=SECRET_KEY, DATABASE_PATH=str(DATABASE_PATH), PERMANENT_SESSION_LIFETIME=SESSION_TIMEOUT_MINUTES * 60)
app.teardown_appcontext(close_db)


def audit(action, entity_type, description, entity_id=None):
    db = get_db()
    db.execute("INSERT INTO audit_logs (user_id,user_role,action,entity_type,entity_id,description,device_id) VALUES (?,?,?,?,?,?,?)", (session.get("user_id"), session.get("role"), action, entity_type, entity_id, description, os.environ.get("VCM_DEVICE_ID", "LOCAL")))
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


@app.cli.command("init-db")
def initialize():
    init_db()
    db = get_db()
    if not query("SELECT id FROM users LIMIT 1", one=True):
        db.execute("INSERT INTO users (username,full_name,password_hash,role) VALUES (?,?,?,?)", (os.environ.get("VCM_ADMIN_USER", "principal"), "Principal", generate_password_hash(os.environ.get("VCM_ADMIN_PASSWORD", "change-me-now")), "PRINCIPAL"))
        db.execute("INSERT INTO users (username,full_name,password_hash,role) VALUES (?,?,?,?)", (os.environ.get("VCM_NURSE_USER", "nurse"), "Nurse", generate_password_hash(os.environ.get("VCM_NURSE_PASSWORD", "change-me-now")), "NURSE"))
        db.commit()
    print(f"Database initialized at {DATABASE_PATH}")


@app.route("/", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        user = query("SELECT * FROM users WHERE username=? AND active=1", (request.form.get("username", "").strip(),), one=True)
        if user and check_password_hash(user["password_hash"], request.form.get("password", "")):
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
    stats = {"students": query("SELECT COUNT(*) c FROM students WHERE status='ACTIVE'", one=True)["c"], "visits": query("SELECT COUNT(*) c FROM sickbay_visits", one=True)["c"], "today": query("SELECT COUNT(*) c FROM sickbay_visits WHERE date(visit_date)=date('now','localtime')", one=True)["c"]}
    students = query("SELECT * FROM students ORDER BY updated_at DESC LIMIT 25")
    return render_template("dashboard.html", stats=stats, students=students, role=session["role"], full_name=session["full_name"])


@app.post("/students")
@login_required
def add_student():
    try:
        db = get_db()
        fields = (request.form["student_id"].strip(), request.form["first_name"].strip(), request.form["last_name"].strip(), request.form.get("admission_number"), request.form.get("current_class"), request.form.get("house"))
        cur = db.execute("INSERT INTO students (student_id,first_name,last_name,admission_number,current_class,house) VALUES (?,?,?,?,?,?)", fields)
        db.commit(); audit("CREATE", "student", f"Created student {fields[1]} {fields[2]}", cur.lastrowid)
        flash("Student saved locally.", "success")
    except sqlite3.IntegrityError:
        flash("Student ID or admission number already exists.", "error")
    return redirect(url_for("dashboard"))


@app.post("/drugs")
@login_required
@role_required("PRINCIPAL", "NURSE")
def add_drug():
    db = get_db(); name = request.form["drug_name"].strip()
    try:
        cur = db.execute("INSERT INTO drugs (drug_name,generic_name,unit,minimum_stock_level) VALUES (?,?,?,?)", (name, request.form.get("generic_name"), request.form.get("unit", "unit"), int(request.form.get("minimum_stock_level", 0))))
        db.commit(); audit("CREATE", "drug", f"Created drug {name}", cur.lastrowid); flash("Drug saved locally.", "success")
    except sqlite3.IntegrityError:
        flash("That drug already exists.", "error")
    return redirect(url_for("dashboard"))


if __name__ == "__main__":
    with app.app_context():
        init_db()
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", 5000)), debug=False)
