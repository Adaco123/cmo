import os
from dotenv import load_dotenv
from app import create_app
# load environment variables from a .env file if present
load_dotenv()

settings_module = os.getenv('APP_SETTINGS_MODULE', 'config.default')
app = create_app(settings_module)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))

    # HTTPS local opcional (mismos certificados de mkcert que usa el frontend en
    # vite.config.ts) — necesario para que el celular pueda pegarle a la API sin
    # que el navegador bloquee la petición por "contenido mixto" (frontend en
    # https, backend en http). Si no se definen estas 2 variables, corre en
    # http normal, igual que siempre.
    ssl_cert = os.environ.get('SSL_CERT_PATH')
    ssl_key = os.environ.get('SSL_KEY_PATH')
    ssl_context = (ssl_cert, ssl_key) if ssl_cert and ssl_key else None

    app.run(host='0.0.0.0', port=port, debug=False, ssl_context=ssl_context)