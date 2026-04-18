param(
    [string]$ProjectId = "projeto-vida-quest"
)

if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Error "firebase nao encontrado. Instale o Firebase CLI antes de executar este script."
    exit 1
}

npm run build
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

firebase use $ProjectId
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

firebase deploy --only hosting
