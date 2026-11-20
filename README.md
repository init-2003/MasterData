# SPTC. Master Data

โค้ด backend ใน `backend/src/` แยกเป็น `Auth/` สำหรับบัญชีและ session, `App/Product/` สำหรับสินค้าและรูป, `Infrastructure/` สำหรับค่าตั้งและฐานข้อมูล และ `Http/` สำหรับจุดรับ API

โค้ด frontend ใน `frontend/src/` ใช้ React และ Tailwind CSS แยกเป็น `auth/` สำหรับบัญชี, `app/product/` สำหรับสินค้า, `shared/` สำหรับ API และตัวช่วยร่วม โดย `app/App.jsx` ประกอบหน้าจอและ `main.jsx` เริ่มแอป ส่วนสไตล์ร่วมอยู่ใน `frontend/src/styles.css`

เว็บสำหรับเข้าสู่ระบบด้วยบัญชีผู้ใช้ และค้นหาข้อมูลหลักสินค้า หน้าจอภาษาไทยใช้ Flat Design ตามสเปก พร้อมรองรับจอมือถือ

## ข้อมูลที่ใช้

| ส่วน | ตารางใน `DBITManagement` |
| --- | --- |
| เข้าสู่ระบบ | `dbo.System_Access` ตรวจ `SUser` ตาม collation ของฐานข้อมูล และเปรียบเทียบ `SPass` แบบตรงตัวใน SQL Server โดยผลลัพธ์ส่งกลับเฉพาะชื่อผู้ใช้ |
| รายการสินค้า | `dbo.Trade` ใช้ `Trade_Id`, `Trade_Name`, `Type_Name`, `Unit_Name` และ `Sale_Price1` |

หน้าสินค้าค้นหาตามรหัสหรือชื่อ แสดงครั้งละ 15 รายการ และเปิดรายละเอียดได้ ตาราง `dbo.Trade` ที่ตรวจพบไม่มีคอลัมน์บาร์โค้ดแยก หากแหล่งข้อมูลเปลี่ยน สามารถกำหนด `DB_PRODUCT_BARCODE` ให้ค้นหาจากคอลัมน์นั้นด้วย

ตัวกรองประเภทอ่านชื่อจาก `dbo.Type` และเทียบกับ `dbo.Trade.Type_Name` ชื่อที่ซ้ำแสดงเพียงครั้งเดียว สินค้าที่มีชื่อประเภทไม่อยู่ในตาราง `Type` ยังพบได้เมื่อเลือก “ทุกประเภท” บัญชีฐานข้อมูลต้องมีสิทธิ์ SELECT คอลัมน์ `Type_Name` ในตาราง `dbo.Type` ตาม `database/grant-read.sql`

ตัวกรองหน่วยอ่านชื่อจาก `dbo.Unit` และเทียบกับ `dbo.Trade.Unit_Name` ชื่อซ้ำแสดงครั้งเดียว สินค้าที่หน่วยไม่อยู่ในตาราง `Unit` พบได้เมื่อเลือก “ทุกหน่วย” บัญชีฐานข้อมูลต้องมีสิทธิ์ SELECT คอลัมน์ `Unit_Name` ใน `dbo.Unit`

หากไม่ได้กำหนด `DB_PRODUCT_*` ระบบใช้ตาราง `dbo.Trade` และคอลัมน์ที่ระบุใน `.env.example` เป็นค่าเริ่มต้น โดยไม่มีคอลัมน์บาร์โค้ด สามารถกำหนดค่าเหล่านี้เพิ่มใน `.env` เมื่อต้องการเปลี่ยนแหล่งข้อมูล

ผู้ใช้ที่เข้าสู่ระบบสามารถแก้ไขราคาขาย คำอธิบายสินค้า (`Trade_Note` สูงสุด 4,000 ตัวอักษร) คำอธิบายโดยย่อ (`Trade_Note_Sort` สูงสุด 255 ตัวอักษร และไม่เกินขนาดคอลัมน์จริง) และจัดการรูปสินค้าได้ โดยระบบตรวจข้อมูลเดิมก่อนบันทึก สำหรับบัญชีฐานข้อมูลแบบจำกัดสิทธิ์ ผู้ดูแลฐานข้อมูลต้องเพิ่มสิทธิ์ UPDATE คอลัมน์ราคา คำอธิบาย และรูปตาม `database/grant-price-update.sql` ก่อนใช้งาน ตรวจชนิดและขนาด `Trade_Note_Sort` ในฐานข้อมูลจริงก่อนเปิดใช้งาน

## ติดตั้งและตรวจการเชื่อมต่อ

1. เตรียม PHP 8.5, Composer, Node.js และ pnpm 11 สำหรับ build ฝั่งหน้าเว็บ ติดตั้ง Microsoft ODBC Driver 18 และเปิด `pdo_sqlsrv` 5.13 สำหรับ PHP รุ่นย่อย สถาปัตยกรรม และ Thread Safety ที่ตรงกับเว็บเซิร์ฟเวอร์ เปิด PHP GD ที่รองรับ JPEG, PNG และ WebP สำหรับรูปสินค้า
2. ติดตั้ง dependencies และ build จากโฟลเดอร์โปรเจกต์

   ```powershell
   composer --working-dir=backend install
   pnpm --dir frontend install --frozen-lockfile
   pnpm --dir frontend build
   ```

3. ใช้ `.env.example` เป็นต้นแบบของ `.env` ระบบใช้ SQL Server `192.168.2.4\SQLEXPRESS` ฐาน `DBITManagement` ให้ตั้ง `DB_USER` และ `DB_PASSWORD` จากบัญชีบริการอ่านข้อมูล ตัวอย่างสิทธิ์อยู่ใน `database/grant-read.sql` ใช้ `DB_SERVER='tcp:192.168.2.4,49707'` ได้เมื่อ instance ยังฟังพอร์ตนี้ หรือใช้ชื่อ instance เพื่อให้ SQL Server Browser ค้นหาพอร์ต

   สำหรับ `.env` หรือ environment ของเครื่องอื่นที่ตั้งค่าไว้ก่อนหน้านี้ ให้เปลี่ยน prefix `POS_SQL_` เป็น `DB_` และ `POS_PRODUCT_` เป็น `DB_PRODUCT_` โดยคงค่าเดิม จากนั้นรีสตาร์ตเว็บเซิร์ฟเวอร์หรือ container ระบบใช้เฉพาะชื่อใหม่
4. รันโปรแกรมตรวจการเชื่อมต่อเพื่อทดสอบการแบ่งหน้า การค้นหารหัส และการปฏิเสธชื่อผู้ใช้ที่ไม่มีใน `System_Access`

   ```powershell
   php backend/bin/check-database.php
   ```

การเชื่อมต่อ SQL เปิดการเข้ารหัสและตรวจใบรับรองโดยค่าเริ่มต้น ตั้ง `DB_TRUST_CERTIFICATE=true` เฉพาะสภาพแวดล้อมภายในที่ยังใช้ใบรับรองทดสอบ หรือ `false` เพื่อตรวจใบรับรอง ค่าดั้งเดิม `1` และ `0` ยังใช้ได้ เก็บ `.env` กับ `var/` ไว้นอก document root และจำกัดสิทธิ์ไฟล์ให้บัญชีที่ใช้รันระบบ

## เริ่มใช้งาน

สินค้าแต่ละรายการมีรูปได้สองช่อง โดยเก็บรูปจริงใน `storage/product-images/<รหัสสินค้า>/` และบันทึกเฉพาะ `<รหัสสินค้า>/<ชื่อไฟล์>` ใน `Trade_Image1` และ `Trade_Image2` ใช้ชื่อไฟล์ต้นฉบับโดยบันทึกเป็น PNG หากชื่อซ้ำจะเติม `-1`, `-2` ตามลำดับ อักขระในรหัสสินค้าหรือชื่อไฟล์ที่ Windows ไม่รองรับจะถูกเข้ารหัส เช่น รหัส `011003.` เป็นโฟลเดอร์ `011003%2E` และ `%` จะถูกเข้ารหัสเพื่อป้องกันชื่อชนกัน

ระบบอื่นสามารถแสดงรูปโดยไม่ต้องเข้าสู่ระบบ ด้วย `api.php?path=` ตามด้วยค่า path จากฐานข้อมูลที่ผ่าน URL encoding เช่น JavaScript ใช้ `new URLSearchParams({ path: imagePath })` ระบบจะส่งเฉพาะไฟล์ที่ path ตรงกับ `Trade_Image1` หรือ `Trade_Image2` ปัจจุบันและอยู่ในโฟลเดอร์รูปที่กำหนด เมื่อลงรูปใหม่ path เดิมจะใช้ไม่ได้ URL ต้องชี้ไปยัง origin และ path ของแอปที่ติดตั้งจริง ไม่ใช่ `127.0.0.1` ของเครื่องอื่น

สำหรับ path เดิมที่ขึ้นต้นด้วย `storage/product-images/` ใช้ `php backend/bin/migrate-image-paths.php` เพื่อตรวจจำนวน path ที่แปลงได้ และเติม `--apply` เมื่อต้องการแปลงจริง สคริปต์ตรวจว่าไฟล์เดิมอยู่ครบ สำรองค่าเดิมใน `storage/image-path-backups/` และอัปเดตภายใน transaction โดยไม่ย้ายไฟล์ ระบบยังรองรับ URL รูปที่ใช้ prefix เดิม

รูป demo แยกไว้ใน `var/demo/product-images/` นอก document root ไฟล์รูปเดิมแบบ hash ยังคงเปิดดูเป็นรูปช่องแรกได้หากยังไม่มี path ในฐานข้อมูล ให้บัญชีที่รัน PHP มีสิทธิ์สร้างและเขียนโฟลเดอร์รูป สำรองโฟลเดอร์รูปพร้อมฐานข้อมูล และไม่ลบเมื่อ deploy IIS/PHP ต้องตั้ง `upload_max_filesize=5M` และ `post_max_size=6M` หรือมากกว่า พร้อมกำหนด IIS request filtering ให้รองรับขนาดคำขอ รูปต้นฉบับ JPEG, PNG หรือ WebP จำกัด 5 MB และขนาดไม่เกิน 4096 พิกเซลต่อด้าน ระบบบันทึกเป็น PNG

### Docker สำหรับพัฒนา

ติดตั้ง Docker Desktop และเปิดใช้งาน Linux containers จากรากโปรเจกต์รัน:

```powershell
docker compose up --build -d
docker compose logs -f
```

รอให้ Composer ติดตั้งเสร็จและ Vite แสดงว่า build เสร็จ แล้วเปิด `http://127.0.0.1:8094/` โดยค่าเริ่มต้นใช้ `APP_MODE=demo` และ HTTP เฉพาะเครื่อง แก้ PHP ได้ทันที ส่วน frontend จะ build ใหม่อัตโนมัติ ให้ refresh เบราว์เซอร์หลัง build เสร็จ ไฟล์ build เขียนลง `public/` เช่นเดียวกับการ build ปกติ

เมื่อแก้ `frontend/vite.config.js` หรือ dependencies ให้รัน `docker compose restart frontend` เพื่อโหลดการตั้งค่าใหม่ แล้วรอให้ build เสร็จก่อน refresh เบราว์เซอร์

เตรียมสินค้าและบัญชีตัวอย่างครั้งแรก (ใช้ PowerShell 7):

```powershell
docker compose exec app php backend/bin/seed-demo.php
(Read-Host 'ตั้งรหัสผ่าน Demo อย่างน้อย 12 ตัว' -MaskInput) | docker compose exec -T app php backend/bin/create-demo-user.php demo.operator
```

หากเคยใช้ฐานข้อมูล demo ก่อนเพิ่มรูปสองช่อง ให้รัน `docker compose exec app php backend/bin/seed-demo.php` อีกครั้งเพื่อเพิ่มคอลัมน์รูปในฐานข้อมูลตัวอย่างเดิม

ข้อมูล demo และ dependencies อยู่ใน Docker volumes และยังอยู่หลัง `docker compose down` หากต้องการทดสอบคำสั่งภายใน container:

```powershell
docker compose exec app composer --working-dir=backend test
docker compose exec app composer --working-dir=backend analyse
docker compose exec frontend pnpm test
```

หากต้องการอ่านฐานข้อมูลจริง ให้ตั้ง `$env:SPTC_DOCKER_MODE = 'production'` ใน PowerShell ก่อนสั่ง `docker compose up -d` และกำหนดค่า `DB_*` ใน `.env` จาก `.env.example` ที่รากโปรเจกต์ แอปอ่านไฟล์นี้ผ่าน source mount โดยตรง บัญชีฐานข้อมูลต้องมีสิทธิ์อ่านตารางที่จำเป็นและ UPDATE ราคาหากต้องการแก้ไขราคา ตรวจการเชื่อมต่อด้วย `docker compose exec app php backend/bin/check-database.php` และตรวจว่า container เข้าถึง SQL Server ได้ ควรใช้ TCP port ที่แน่นอนหาก SQL Server Browser ค้นหา instance ไม่ได้ Docker ใช้ HTTP สำหรับเครื่องพัฒนาเท่านั้น

หยุดบริการด้วย `docker compose down` Docker ชุดนี้มีไว้สำหรับพัฒนาเท่านั้น การ deploy production ยังคงใช้ IIS ตามด้านล่าง

### PHP built-in server สำหรับพัฒนา

```powershell
.\deploy\start-local.ps1
```

เปิด `http://127.0.0.1:8094/` แล้วใช้ชื่อผู้ใช้และรหัสผ่านเดิมของฐานข้อมูล สคริปต์จะใช้ไดรเวอร์จาก `php.ini` หรือ DLL PHP 8.5 x64 Thread Safe ใน `.tools/msphpsql/Windows/` หากติดตั้งไว้เฉพาะโปรเจกต์

### Apache/XAMPP และ IIS

- **Apache/XAMPP** ใช้ `public/` เป็น DocumentRoot หรือเพิ่ม Alias ตาม `deploy/apache.conf.example` เปิด PHP 8.5 handler และตรวจให้ทั้งเส้นทางใหม่และเว็บหลักของ XAMPP เปิดได้เฉพาะไฟล์สาธารณะของโปรเจกต์
- **IIS** ตั้ง Physical Path ของไซต์หรือแอปเป็น `public/` เพิ่ม PHP 8.5 FastCGI handler สำหรับ `*.php` และเปิด `pdo_sqlsrv` ใน `php.ini` ของ FastCGI ใช้ `public/web.config` สำหรับ Default Document และการส่ง JSON error status
- โฟลเดอร์ `storage/product-images/` และ `var/` มีไฟล์ตัวแทนใน Git เพื่อให้พร้อมหลัง clone โดยรูปจริง ข้อมูลชั่วคราว และ log ไม่ถูกเก็บใน Git ให้สิทธิ์ Modify แก่บัญชีที่รัน PHP บนทั้งสองโฟลเดอร์รวมไฟล์และโฟลเดอร์ย่อย หาก IIS ใช้ ApplicationPoolIdentity ให้เพิ่ม `IIS AppPool\<ชื่อ Application Pool>` ในสิทธิ์ Security ของโฟลเดอร์
- **ทั้งสองแบบ** ใช้ HTTPS และ `APP_HTTPS=true` ให้บัญชีที่รัน PHP อ่าน `.env` และเขียนใน `var/` ได้ ให้ document root ตอบ `index.html` เป็นหน้าเริ่มต้น ค่า `false` ใช้เมื่อพัฒนาผ่าน HTTP และยังรองรับค่าเดิม `1` กับ `0`

### เตรียมและสำรอง IIS production

- ติดตั้ง Composer dependencies สำหรับ production ด้วย `composer --working-dir=backend install --no-dev --optimize-autoloader` และ build frontend ด้วย `pnpm --dir frontend install --frozen-lockfile` ตามด้วย `pnpm --dir frontend build` ในสภาพแวดล้อม build ที่เชื่อถือได้
- นำ `public/` (รวม `index.html`, `assets/`, `api.php` และ `web.config`) และ `backend/src/`, `backend/vendor/` ไปวางโดยรักษาโครงสร้างสัมพัทธ์ของโปรเจกต์ ตั้ง IIS Physical Path ไปที่ `public/` เท่านั้น จัด `.env`, `var/` และ `storage/` ไว้ในโฟลเดอร์โปรเจกต์เหนือ document root
- ก่อนอัปเดต ให้สำรอง `.env` อย่างปลอดภัยและสำรอง `storage/product-images/` แยกจากไฟล์ที่ build ตรวจว่ากู้คืนได้ และอย่าทับหรือลบโฟลเดอร์รูปเมื่อ deploy ควรสำรองฐานข้อมูลตามขั้นตอนของผู้ดูแลฐานข้อมูลด้วย
- ให้บัญชี FastCGI อ่านโค้ดและ `.env` และเขียนได้เฉพาะ `var/` กับ `storage/product-images/` ตรวจสิทธิ์และทดสอบ login, ค้นหา และรูปสินค้าหลัง deploy
- เมื่อ API มีข้อผิดพลาด ตรวจ log โหมด production ที่ `var/production/app.log` โดยไม่เผยแพร่ข้อมูลลับ

## ทดสอบ

```powershell
composer --working-dir=backend test
composer --working-dir=backend analyse
pnpm --dir frontend test
```

เมื่อมี Docker image และ frontend build พร้อมแล้ว รัน integration test ด้วย PowerShell จากรากโปรเจกต์:

```powershell
.\deploy\test-integration.ps1
```

คำสั่งนี้สร้าง container ชั่วคราวพร้อมฐานข้อมูล SQLite และรูปตัวอย่างแยกต่างหาก ตรวจ API ตั้งแต่การปฏิเสธผู้ที่ยังไม่เข้าสู่ระบบ, login, ค้นหาภาษาไทย, แบ่งหน้า, แก้ราคาและตรวจการชนกัน, อัปโหลดและอ่านรูป, จนถึง logout แล้วลบ container เมื่อเสร็จ ไม่ใช้ฐานข้อมูลหรือรูป production ชุดนี้ตรวจ HTTP API และ HTML เบื้องต้น ยังต้องตรวจการโต้ตอบผ่านเบราว์เซอร์แยกต่างหาก

สำหรับทดสอบ UI โดยใช้ข้อมูลตัวอย่างและ SQLite ใน `var/demo` ให้เปิด `pdo_sqlite` และใช้ PowerShell 7

```powershell
$env:APP_MODE = 'demo'
php backend/bin/seed-demo.php
(Read-Host 'ตั้งรหัสผ่าน Demo อย่างน้อย 12 ตัว' -MaskInput) | php backend/bin/create-demo-user.php demo.operator
.\deploy\start-local.ps1
```
