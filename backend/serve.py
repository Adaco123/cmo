
from waitress import serve
from entrypoint import app

if __name__ == "__main__":
    serve(
        app,
        host="127.0.0.1",   # Waitress solo escucha en localhost.
        port=8000,          # El HTTPS hacia afuera lo pondrá Caddy en el puerto 5000.
        threads=8,          # Hasta 8 peticiones en simultáneo.
    )