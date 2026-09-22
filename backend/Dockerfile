FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_SETTINGS_MODULE=docker_settings \
    FLASK_APP=entrypoint
EXPOSE 5000
CMD ["gunicorn", "-w", "2", "--timeout", "120", "-b", "0.0.0.0:5000", "entrypoint:app"]