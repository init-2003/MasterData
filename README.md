# SPTC. Master Data

โค้ด backend ใน `backend/src/` แยกเป็น `Controllers/Admin/` และ `Controllers/Customer/` ตามโดเมน, `Models/` สำหรับอ่านและบันทึกฐานข้อมูล, `Services/` สำหรับบัญชี session และรูป, `Middleware/` สำหรับตรวจ CSRF และ `HostGuard` และ `Core/` สำหรับ API และการตั้งค่าฐานข้อมูล โดย `backend/routes/admin.php` และ `backend/routes/customer.php` แยก action และ HTTP method ของแต่ละโดเมน

โค้ด frontend ใน `frontend/` แยกออกเป็น 3 ส่วน:
- `frontend/customer/` — หน้าลูกค้า (สไลด์ แบนเนอร์ โปรโมชัน และค้นหา/ดูสินค้า) build ลง `public/customer/`
- `frontend/admin/` — หน้าจัดการระบบ Master Data (Login, สินค้า, ภาพเว็บไซต์) build ลง `public/admin/`
- `frontend/shared/` — ไฟล์ที่ใช้ร่วมกัน (ตัวช่วยจัดรูปแบบราคา/ตัวเลข และโลโก้)

### Domain-based Routing (4 โดเมน: เว็บหลัก, `www`, `api`, `admin`)

ระบบแยก Static Frontend ออกจาก Backend API ออกเป็น 3 Document Root:
- **`public/customer/`** — เว็บไซต์หลัก (`https://example.com` และ `https://www.example.com` → 301 Redirect ไปโดเมนหลัก, Static ไม่มี PHP)
- **`public/api/`** — Backend API จุดเดียว (`https://api.example.com`, PHP 8.5 รับ `/customer/*`, `/admin/*`, `/website-images/*`, `/product-images/*` พร้อม CORS + HostGuard + Session `Path=/admin`)
- **`public/admin/`** — ระบบหลังบ้าน (`https://admin.example.com`, Static ไม่มี PHP + `X-Robots-Tag: noindex, nofollow`)

- **พัฒนาในเครื่อง (`.\deploy\start-local.ps1` หรือ Docker)**:
  - เว็บไซต์หลัก: `http://shop.localhost:8094/` (`http://www.shop.localhost:8094/` จะ 301 ไป `shop.localhost`)
  - Backend API: `http://api.localhost:8094/`
  - ระบบหลังบ้าน: `http://admin.localhost:8094/`
- **ขึ้นโฮสต์จริง (IIS / Apache)**:
  - ตั้ง `API_HOSTS`, `CUSTOMER_ORIGINS`, `ADMIN_ORIGINS` และ `APP_PUBLIC_ORIGIN='https://api.example.com'` ใน `.env`
  - สั่ง build พร้อมระบุ API URL จริง: `$env:VITE_API_BASE_URL='https://api.example.com'; pnpm --dir frontend build` (จะอัปเดต CSP `connect-src` ให้ตรงกับโดเมน API อัตโนมัติ)
  - บน **IIS**: สร้าง 3 Sites (`example.com` + `www.example.com` → `public/customer/`, `api.example.com` → `public/api/` พร้อม PHP FastCGI + URL Rewrite, `admin.example.com` → `public/admin/`)
  - บน **Apache**: ตั้ง 3 VirtualHosts ตามตัวอย่างใน `deploy/apache-vhosts.conf.example`

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

1. เตรียม PHP 8.5, Composer, Node.js และ pnpm 11 สำหรับ build ฝั่งหน้าเว็บ ติดตั้ง Microsoft ODBC Driver 18 และเปิด `pdo_sqlsrv` 5.13 สำหรับ PHP รุ่นย่อย สถาปัตยกรรม และ Thread Safety ที่ตรงกับเว็บเซิร์ฟเวอร์ เปิด PHP GD ที่รองรับ JPEG, PNG, WebP และ AVIF สำหรับรูปสินค้าและภาพเว็บไซต์
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

สินค้าแต่ละรายการมีรูปได้สองช่อง โดยแต่ละช่องเลือกบันทึกได้ 2 แบบลงใน `Trade_Image1` และ `Trade_Image2` (คอลัมน์ `VARCHAR(200)` เดิม):
1. **อัปโหลดไฟล์**: เก็บรูปจริงใน `storage/product-images/<รหัสสินค้า>/` โดยใช้ชื่อไฟล์เดิมและเก็บตามชนิดไฟล์ต้นฉบับ JPEG, PNG, WebP หรือ AVIF (หากชื่อซ้ำเติม `-1`, `-2` ตามลำดับ) อักขระในรหัสสินค้าหรือชื่อไฟล์ที่ Windows ไม่รองรับจะถูกเข้ารหัส เช่น รหัส `011003.` เป็นโฟลเดอร์ `011003%2E` จากนั้นระบบสร้างลิงก์เต็มแบบไม่มี `api.php` จาก `APP_PUBLIC_ORIGIN` และ `APP_BASE_PATH` เช่น `https://assets.example.com/master-data/product-images/SP-0001/tile.jpg` และตรวจความยาวไม่เกินขนาดคอลัมน์ (`200` ไบต์) ก่อนบันทึก
2. **ใส่ลิงก์ภาพ**: กรอกลิงก์ `http://` หรือ `https://` พร้อมดูตัวอย่างก่อนบันทึกได้ ระบบตรวจรูปแบบลิงก์ ความยาวตามขนาดคอลัมน์ (`200` ไบต์) และเทียบชื่อโดเมนแบบตรงตัวตาม `WEBSITE_ALLOWED_IMAGE_HOSTS` เมื่อมีการตั้งค่า (เว้นว่าง = ใส่ลิงก์ได้ทันที)

ระบบอื่นสามารถแสดงรูปสินค้าที่อัปโหลดโดยไม่ต้องเข้าสู่ระบบผ่านลิงก์ `/product-images/<รหัสสินค้า>/<ชื่อไฟล์>` (ใช้ IIS URL Rewrite ใน `public/web.config` หรือ Apache `mod_rewrite` ใน `public/.htaccess` / `deploy/apache.conf.example`) และยังคงรองรับ `api.php?path=` สำหรับพาธเดิมที่บันทึกไว้ก่อนหน้า ระบบจะส่งเฉพาะไฟล์ที่อ้างอิงอยู่ใน `Trade_Image1` หรือ `Trade_Image2` ปัจจุบัน เมื่อลงรูปใหม่หรือลบออก ลิงก์เดิมจะคืน `404` ทันที

สำหรับ path เดิมที่ขึ้นต้นด้วย `storage/product-images/` ใช้ `php backend/bin/migrate-image-paths.php` เพื่อตรวจจำนวน path ที่แปลงได้ และเติม `--apply` เมื่อต้องการแปลงจริง สคริปต์ตรวจว่าไฟล์เดิมอยู่ครบ สำรองค่าเดิมใน `storage/image-path-backups/` และอัปเดตภายใน transaction โดยไม่ย้ายไฟล์ ระบบยังรองรับ URL รูปที่ใช้ prefix เดิม

รูป demo แยกไว้ใน `var/demo/product-images/` นอก document root ไฟล์รูปเดิมแบบ hash ยังคงเปิดดูเป็นรูปช่องแรกได้หากยังไม่มี path ในฐานข้อมูล ให้บัญชีที่รัน PHP มีสิทธิ์สร้างและเขียนโฟลเดอร์รูป สำรองโฟลเดอร์รูปพร้อมฐานข้อมูล และไม่ลบเมื่อ deploy IIS/PHP ต้องตั้ง `upload_max_filesize=12M` และ `post_max_size=13M` หรือมากกว่า และ `memory_limit=256M` หรือมากกว่า พร้อมกำหนด IIS request filtering ให้รองรับขนาดคำขอ รูปต้นฉบับ JPEG, PNG, WebP หรือ AVIF จำกัด 12 MB และขนาดไม่เกิน 8,192 พิกเซลต่อด้าน และ 36 ล้านพิกเซลรวม ระบบเข้ารหัสและบันทึกตามชนิดภาพต้นฉบับ

### แบนเนอร์ต้อนรับ โปรโมชันลดราคา และภาพสไลด์

ทั้งสามเมนูใช้ตารางเดิมใน `DBITManagement` ได้แก่ `dbo.Web_Promo_WelCome` (แบนเนอร์ต้อนรับ, `collection=promo-banner`), `dbo.Web_Promo_Sale` และ `dbo.Web_Carousel` หากบัญชีบริการยังไม่มีสิทธิ์จัดการรายการ ให้ผู้ดูแล SQL Server รัน [database/website-images.sql](database/website-images.sql) ในโหมด Demo ให้รัน `backend/bin/seed-demo.php` เพื่อเพิ่มสามตารางใน SQLite

ผู้ใช้ที่เข้าสู่ระบบสามารถจัดการทั้งสามเมนูได้ผ่าน Session เดิม รูปใช้เงื่อนไขการอัปโหลดเดียวกับรูปสินค้า และจัดเก็บใน `storage/website-images/` หรือ `var/demo/website-images/` สำหรับ Demo ให้บัญชี PHP มีสิทธิ์เขียน และสำรองโฟลเดอร์รูปพร้อมฐานข้อมูล รายการใหม่เริ่มต้นเป็นปิดการแสดงและเรียงตามค่าลำดับจากน้อยไปมาก สถานะเปิดการแสดงบันทึกอยู่ในตารางสำหรับใช้งานต่อ

รูปในเมนูเว็บไซต์เลือกบันทึกได้ 2 แบบลงในคอลัมน์ `Image_Url` เดิมของทั้งสามตาราง:
1. **อัปโหลดไฟล์**: ใช้ชื่อไฟล์เดิมและเก็บตามชนิด JPEG, PNG, WebP หรือ AVIF ใน `storage/website-images/<collection>/` หากชื่อซ้ำในเมนูเดียวกัน ระบบเติม `-1`, `-2` ก่อนนามสกุล แล้วสร้างลิงก์เต็มแบบไม่มี `api.php` จาก `APP_PUBLIC_ORIGIN` และ `APP_BASE_PATH` ใน `.env` เช่น `https://assets.example.com/master-data/website-images/promo-banner/banner.jpg` เพื่อบันทึกลง `Image_Url` เว็บปลายทางสามารถเปิดลิงก์นี้ได้โดยไม่ต้องเข้าสู่ระบบเฉพาะรายการที่เปิดการแสดง (`Is_Active = 1`) ส่วนหน้าจัดการยังดูตัวอย่างของรายการที่ปิดการแสดงได้ผ่าน Session (บน IIS ต้องเปิดใช้ IIS URL Rewrite module ร่วมกับ `public/web.config` และบน Apache ต้องเปิด `mod_rewrite` ร่วมกับ `public/.htaccess` หรือ `deploy/apache.conf.example`)
2. **ใส่ลิงก์ภาพ**: กรอกลิงก์ `http://` หรือ `https://` ของภาพโดยตรงและดูตัวอย่างก่อนบันทึกได้ สำหรับ `dbo.Web_Promo_WelCome` และ `dbo.Web_Promo_Sale` ระบบจะบันทึกลิงก์ลงคอลัมน์ `Link_Url` และตั้ง `Image_Url` เป็นสตริงว่าง `''` (และล้าง `Link_Url` เป็น `NULL` เมื่อเปลี่ยนกลับไปอัปโหลดไฟล์) ส่วน `dbo.Web_Carousel` ที่ไม่มีคอลัมน์ `Link_Url` จะบันทึกลง `Image_Url` ตามเดิม ระบบตรวจรูปแบบลิงก์และความยาวตามขนาดคอลัมน์ของแต่ละตารางก่อนบันทึก หากต้องการจำกัดเฉพาะบางโดเมนสามารถกำหนด `WEBSITE_ALLOWED_IMAGE_HOSTS` (คั่นด้วยจุลภาค) ใน `.env` เพิ่มได้ โดยระบบจะเทียบชื่อโดเมนแบบตรงตัวเท่านั้น เช่น `cdn.example.com` (ไม่รวม subdomain หรือ wildcard) และหากเว้นว่างไว้จะอนุญาตทุกลิงก์ `http://` / `https://` ที่รูปแบบถูกต้อง

ระบบยังรองรับพาธรูปเก่าที่บันทึกไว้แล้วทั้งแบบ `website-images/<collection>/<filename>` และแบบชื่อไฟล์เปล่าเดิม (ตั้ง `WEBSITE_LEGACY_IMAGE_BASE_URL` เพื่อแสดงตัวอย่างในหน้าจัดการ เช่น `https://example.com/images/promotions`) การเปลี่ยนรูปหรือลบรายการจะเก็บไฟล์เดิมไว้เผื่อมีการอ้างอิงจากส่วนอื่น แต่ลิงก์สาธารณะจะเปิดไม่ได้ทันทีเมื่อรายการถูกปิดการแสดง ถูกแทนที่ หรือถูกลบ การลบรายการต้องใช้สิทธิ์ `DELETE` บนตารางของเมนูตามสคริปต์ให้สิทธิ์ข้างต้น

### โปรโมชันตามระดับ

เมนูนี้ใช้ตารางเดิม `dbo.Web_Promotion_Level` ภาพหนึ่งรายการผูกกับระดับลูกค้าหนึ่งระดับ รายการระดับอ่านจาก `dbo.Customer` โดยแสดงชื่อจาก `Customer_Type` และบันทึกรหัสจาก `Customer_Lavel` (เช่น `2` = ขายส่ง 1) ระบบบันทึกชื่อ `Customer_Type` ณ เวลาบันทึกลง `Level_Name` และตรวจว่ารหัสระดับยังมีอยู่ใน `dbo.Customer` ก่อนบันทึก (ตอบ `400 invalid_level` หากไม่พบ) สคริปต์ [database/website-images.sql](database/website-images.sql) ให้สิทธิ์จัดการตารางนี้และอ่านเฉพาะคอลัมน์ `Customer_Lavel`, `Customer_Type` ของ `dbo.Customer`

| คอลัมน์ | การใช้งาน |
| --- | --- |
| `Auto_ID` | คีย์รายการ |
| `Customer_Lavel`, `Level_Name` | รหัสและชื่อระดับลูกค้า |
| `Image_Url` | **ชื่อไฟล์เท่านั้น** (ตามข้อมูลเดิม) ไฟล์อยู่ใน `storage/website-images/promotion-level/` หรือลิงก์ภาพภายนอกเมื่อเลือกใส่ลิงก์ |
| `Remark` | คำอธิบายภาพ (ไม่บังคับ) |
| `Is_Active` | เปิด/ปิดการแสดง (`Status` คงค่าเดิม ไม่ได้ใช้ในเมนูนี้) |
| `Sort_Order` | ลำดับภายในระดับเดียวกัน รายการใหม่หรือย้ายระดับจะต่อท้ายระดับนั้น |

หน้าจัดการกรองรายการตามระดับได้ (เริ่มที่ "ทุกระดับ") และแก้ไขลำดับได้เมื่อเลือกระดับใดระดับหนึ่ง เพราะลำดับบันทึกแยกตามระดับ การอัปโหลดในเมนูนี้ไม่ต้องตั้ง `APP_PUBLIC_ORIGIN` เพราะบันทึกเฉพาะชื่อไฟล์ ส่วนรูปของรายการเดิมที่ระบบก่อนหน้าอัปโหลดไว้ ให้คัดลอกไฟล์ (ชื่อเดิม) มาไว้ใน `storage/website-images/promotion-level/` หากยังไม่ได้คัดลอก หน้าจัดการจะแสดงตัวอย่างจาก `WEBSITE_LEGACY_IMAGE_BASE_URL` แทน

ลิงก์ `/website-images/promotion-level/<ชื่อไฟล์>` เปิดได้โดยไม่ต้องเข้าสู่ระบบเฉพาะรายการที่เปิดการแสดง เหมือนเมนูอื่น การแสดงภาพเฉพาะลูกค้าตามระดับบนหน้าลูกค้ายังไม่ได้ทำ (`/customer/storefront` ยังไม่ส่งภาพของเมนูนี้)

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
- นำ `public/` (รวม `index.html`, `assets/`, `api.php` และ `web.config`) และ `backend/src/`, `backend/routes/`, `backend/vendor/` ไปวางโดยรักษาโครงสร้างสัมพัทธ์ของโปรเจกต์ ตั้ง IIS Physical Path ไปที่ `public/` เท่านั้น จัด `.env`, `var/` และ `storage/` ไว้ในโฟลเดอร์โปรเจกต์เหนือ document root
- ก่อนอัปเดต ให้สำรอง `.env` อย่างปลอดภัยและสำรอง `storage/product-images/` แยกจากไฟล์ที่ build ตรวจว่ากู้คืนได้ และอย่าทับหรือลบโฟลเดอร์รูปเมื่อ deploy ควรสำรองฐานข้อมูลตามขั้นตอนของผู้ดูแลฐานข้อมูลด้วย
- ให้บัญชี FastCGI อ่านโค้ดและ `.env` และเขียนได้เฉพาะ `var/` กับ `storage/product-images/` ตรวจสิทธิ์และทดสอบ login, ค้นหา และรูปสินค้าหลัง deploy
- หาก IIS อ่านโค้ดจาก Network Share ให้ตั้ง `APP_RUNTIME_DIR='D:\tempweb\var\production'` ใน `.env` ของเว็บจริงเพื่อเก็บ session, cache, ไฟล์ล็อก Login และ log บนดิสก์ของ IIS สร้างโฟลเดอร์นอก document root และให้บัญชีที่รัน PHP เขียนได้ด้วยสิทธิ์ Modify ผู้ใช้ต้องเข้าสู่ระบบอีกครั้งหลังย้าย session หากเว้นค่าไว้จะใช้ `var/production` โหมด demo ใช้ `var/demo` ตามเดิม
- เมื่อ API มีข้อผิดพลาด ตรวจ `app.log` ใน `APP_RUNTIME_DIR` หรือ `var/production` เมื่อใช้ค่าเริ่มต้น โดยไม่เผยแพร่ข้อมูลลับ

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

### บัญชีลูกค้าใน dbo.Customer

`Cus_User` และ `Cus_SPass` (varchar(50)) มีอยู่แล้วใน `dbo.Customer` ค่า `Cus_User` ที่ไม่ว่างต้องไม่ซ้ำกันตาม unique index `UX_Customer_Cus_User` ใน [database/customer-user-unique.sql](database/customer-user-unique.sql) (ยกเว้นค่าว่างและ `NULL` เพราะค่าเริ่มต้นของคอลัมน์เป็น `''`) เป็น filtered index โปรแกรมที่ INSERT/UPDATE ตารางนี้จึงต้องเชื่อมต่อด้วย `ANSI_NULLS`, `ANSI_WARNINGS`, `QUOTED_IDENTIFIER` เปิดอยู่ (ค่าเริ่มต้นของ ODBC/SqlClient) ยกเลิกได้ด้วย `DROP INDEX UX_Customer_Cus_User ON dbo.Customer`
