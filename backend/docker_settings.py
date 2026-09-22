import os
from datetime import timedelta

SECRET_KEY = os.environ["SECRET_KEY"]

PROPAGATE_EXCEPTIONS = True
SQLALCHEMY_DATABASE_URI = os.environ["DATABASE_URL"]
SQLALCHEMY_TRACK_MODIFICATIONS = False
SHOW_SQLALCHEMY_LOG_MESSAGES = False
ERROR_404_HELP = False
JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=2)

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "")

ARCHIVOS_UPLOAD_DIR = os.environ.get("ARCHIVOS_UPLOAD_DIR", "/app/uploads")