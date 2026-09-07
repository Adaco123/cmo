import os
from dotenv import load_dotenv
from app import create_app
# load environment variables from a .env file if present
load_dotenv()

settings_module = os.getenv('APP_SETTINGS_MODULE', 'config.default')
app = create_app(settings_module)

