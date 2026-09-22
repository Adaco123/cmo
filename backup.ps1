$fecha = Get-Date -Format "yyyy-MM-dd_HH-mm"
$carpeta = "D:\CMO\backups"

# 1. Respaldo de la base de datos
docker compose exec -T db pg_dump -U cmo -d cmo -F c -f /tmp/backup.dump
docker cp cmo-db-1:/tmp/backup.dump "$carpeta\db_$fecha.dump"

# 2. Respaldo de los archivos subidos (fotos, PDFs)
docker cp cmo-backend-1:/app/uploads "$carpeta\uploads_$fecha"

# 3. Borrar respaldos de más de 14 días
Get-ChildItem $carpeta | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } | Remove-Item -Recurse -Force

Write-Host "Respaldo completado: $fecha"