# VCM SICKBAY SYSTEM

Offline-first Flask/SQLite foundation for school sickbay records. The original HTML prototypes remain in the repository; the working backend MVP is `app.py`.

## Run locally

```bash
python -m venv .venv
.venv\\Scripts\\activate       # Windows
source .venv/bin/activate       # macOS/Linux
pip install -r requirements.txt
flask --app app initialize
flask --app app run
```

Open http://127.0.0.1:5000. The initializer creates development accounts from environment variables (defaults: `principal` / `change-me-now` and `nurse` / `change-me-now`). Change these before real use. Never commit `vcm_sickbay.db` or real student data.

This first increment provides SQLite schema, hashed authentication, role checks, audit logging, student registration, dashboard counts, and an offline-capable static shell. Remaining phases include visits, complete batch transactions, reports, backups, sync processing, and production PWA packaging.
