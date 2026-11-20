param([ValidateRange(1024, 65535)][int] $Port = 8094)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$public = Join-Path $root 'public'
if (!(Test-Path -LiteralPath (Join-Path $public 'index.html'))) {
    throw 'Build the frontend before starting the server.'
}

$phpArgs = @()
if ($env:APP_MODE -ne 'demo') {
    php --ri pdo_sqlsrv *> $null
    if ($LASTEXITCODE -ne 0) {
        $driver = Join-Path $root '.tools/msphpsql/Windows/php_pdo_sqlsrv_85_ts_x64.dll'
        if (!(Test-Path -LiteralPath $driver)) {
            throw 'Enable PDO_SQLSRV for PHP 8.5 before starting in production mode.'
        }
        $phpArgs = @('-d', "extension=$driver")
    }
}

$env:APP_HTTPS = '0'
& php @phpArgs -S "127.0.0.1:$Port" -t $public (Join-Path $PSScriptRoot 'router.php')
exit $LASTEXITCODE
