from entrypoint import app
from app.db import db

with app.app_context():
    db.create_all()
    print("Tablas creadas / verificadas")