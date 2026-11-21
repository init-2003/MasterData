#!/bin/sh
set -eu

# This directory lives only inside the disposable test container.
test_root="$(mktemp -d /tmp/sptc-integration.XXXXXX)"
if [ ! -f /app/backend/vendor/autoload.php ]; then composer --working-dir=/app/backend install --no-interaction; fi
mkdir -p "$test_root/backend" "$test_root/public" "$test_root/database" "$test_root/deploy"
cp -R /app/backend/bin /app/backend/src /app/backend/routes "$test_root/backend/"
ln -s /app/backend/vendor "$test_root/backend/vendor"
cp /app/public/api.php /app/public/index.html "$test_root/public/"
cp -R /app/public/assets "$test_root/public/assets"
cp /app/database/demo.sql "$test_root/database/"
cp /app/deploy/router.php "$test_root/deploy/"
cd "$test_root"
export APP_MODE=demo APP_HTTPS=false
php backend/bin/seed-demo.php
php /app/backend/tests/prepare-legacy-image.php
php backend/bin/migrate-image-paths.php --apply
printf '%s\n' 'integration-demo-password' | php backend/bin/create-demo-user.php integration.test
exec php -S 0.0.0.0:8094 -t public deploy/router.php
