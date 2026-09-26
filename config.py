import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = Path(os.environ.get("VCM_DATABASE_PATH", BASE_DIR / "vcm_sickbay.db"))
SECRET_KEY = os.environ.get("VCM_SECRET_KEY", "change-this-secret-before-production")
SESSION_TIMEOUT_MINUTES = int(os.environ.get("VCM_SESSION_TIMEOUT_MINUTES", "30"))
