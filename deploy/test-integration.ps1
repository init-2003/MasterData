$ErrorActionPreference = 'Stop'
$taskName = 'sptc-test-' + [guid]::NewGuid().ToString('N')
try {
    docker compose run --rm -d --no-deps --name $taskName app sh backend/tests/integration-server.sh | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Unable to start the isolated demo server.' }
    docker compose run --rm --no-deps -e "TEST_BASE_URL=http://${taskName}:8094" frontend node tests/integration.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Integration checks failed.' }
} finally {
    docker stop $taskName 2>$null | Out-Null
}
