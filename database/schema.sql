PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('PRINCIPAL','NURSE')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS academic_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_name TEXT NOT NULL UNIQUE,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS terms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES academic_sessions(id),
    term_name TEXT NOT NULL CHECK (term_name IN ('First Term','Second Term','Third Term')),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    UNIQUE(session_id, term_name)
);

CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    middle_name TEXT,
    last_name TEXT NOT NULL,
    gender TEXT,
    date_of_birth TEXT,
    admission_number TEXT UNIQUE,
    current_class TEXT,
    house TEXT,
    guardian_name TEXT,
    guardian_phone TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','GRADUATED','TRANSFERRED','INACTIVE')),
    admission_date TEXT,
    graduation_date TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_students_name ON students(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);

CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id),
    session_id INTEGER NOT NULL REFERENCES academic_sessions(id),
    class_name TEXT NOT NULL,
    house TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, session_id)
);

CREATE TABLE IF NOT EXISTS sickbay_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id),
    session_id INTEGER REFERENCES academic_sessions(id),
    term_id INTEGER REFERENCES terms(id),
    visit_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    complaint TEXT NOT NULL,
    symptoms TEXT,
    diagnosis TEXT,
    temperature REAL,
    blood_pressure TEXT,
    pulse INTEGER,
    treatment TEXT,
    notes TEXT,
    nurse_id INTEGER REFERENCES users(id),
    sent_home INTEGER NOT NULL DEFAULT 0,
    sent_home_date TEXT,
    return_date TEXT,
    reason_for_visit TEXT,
    device_id TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_visits_student_date ON sickbay_visits(student_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_visits_session_term ON sickbay_visits(session_id, term_id);

CREATE TABLE IF NOT EXISTS drugs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drug_name TEXT NOT NULL UNIQUE,
    generic_name TEXT,
    strength TEXT,
    dosage_form TEXT,
    unit TEXT NOT NULL DEFAULT 'unit',
    minimum_stock_level INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS drug_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drug_id INTEGER NOT NULL REFERENCES drugs(id),
    batch_number TEXT NOT NULL,
    quantity_received INTEGER NOT NULL CHECK(quantity_received >= 0),
    quantity_remaining INTEGER NOT NULL CHECK(quantity_remaining >= 0),
    expiry_date TEXT,
    date_received TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    supplier TEXT,
    received_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(drug_id, batch_number)
);
CREATE TABLE IF NOT EXISTS drug_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drug_id INTEGER NOT NULL REFERENCES drugs(id),
    batch_id INTEGER REFERENCES drug_batches(id),
    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('RECEIVED','ISSUED','ADJUSTMENT','RETURNED','EXPIRED','DAMAGED')),
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    student_id INTEGER REFERENCES students(id),
    sickbay_visit_id INTEGER REFERENCES sickbay_visits(id),
    nurse_id INTEGER REFERENCES users(id),
    transaction_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    device_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    user_role TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    description TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    device_id TEXT,
    sync_status TEXT NOT NULL DEFAULT 'PENDING'
);
CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    device_id TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id),
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payload TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'PENDING',
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_attempt TEXT,
    synced_at TEXT
);
