# SPTC. Master Data

## ขอบเขตระบบ

- เว็บภายในสำหรับ Login, Logout และอ่านข้อมูลหลักสินค้า หน้าจอและข้อความผู้ใช้เป็นภาษาไทย
- SQL Server ฐาน `DBITManagement` เป็นแหล่งข้อมูลจริง ใช้ `dbo.Trade` สำหรับสินค้าและ `dbo.System_Access` สำหรับบัญชีเดิม ผู้ใช้ที่เข้าสู่ระบบแก้ไขราคาขายและอัปโหลดรูปสินค้าได้ การเปลี่ยนข้อมูลอื่นหรือเพิ่มโมดูลต้องมีคำขอโดยตรง
- เมนูโปรโมชันตามระดับ (`collection=promotion-level`) ใช้ `dbo.Web_Promotion_Level` เก็บ `Image_Url` เป็นชื่อไฟล์เท่านั้น เปิด/ปิดด้วย `Is_Active` เรียงลำดับแยกตาม `Customer_Lavel` และอ่านระดับจาก `dbo.Customer` (`Customer_Lavel` = รหัส, `Customer_Type` = ชื่อที่แสดง) หน้าลูกค้ายังไม่กรองภาพตามระดับ
- อ่าน [design.md](design.md) ก่อนแก้หน้าจอ ดูวิธีติดตั้งและรันใน [README.md](README.md)

## จุดเข้าและไฟล์ต้นทาง

| เส้นทาง | หน้าที่ |
| --- | --- |
| `frontend/admin/`, `frontend/vite.admin.config.js` | หน้าจัดการระบบ Master Data (Static build ลง `public/admin/` สำหรับ `admin.*`) |
| `frontend/customer/`, `frontend/vite.customer.config.js` | หน้าลูกค้า สไลด์/แบนเนอร์/โปรโมชัน และแคตตาล็อกสินค้า (Static build ลง `public/customer/` สำหรับโดเมนหลักและ `www.*`) |
| `frontend/shared/` | ตัวช่วยและไฟล์ที่ใช้ร่วมกัน (`format.js`, `api-base.js`, โลโก้) |
| `frontend/admin/src/store/` | `app-model.js` รวมสถานะแอป, `product/` แยกเป็น `catalog`, `detail`, `notes`, `images` และ `context` (ตัวแปรที่ใช้ร่วมกัน) รวมด้วย `product.js` |
| `frontend/admin/src/styles/` | `global.css` import ไฟล์ใน `areas/` ตามลำดับ (ลำดับมีผลเมื่อกฎมีความจำเพาะเท่ากัน) แก้สไตล์ในไฟล์ของส่วนนั้น |
| `public/api/index.php` | จุดเข้า PHP Backend API จุดเดียวสำหรับ `api.*` (`/customer/*`, `/admin/*`, `/website-images/*`, `/product-images/*`) พร้อม Monolog |
| `backend/src/Controllers/Admin/`, `backend/src/Controllers/Customer/`, `backend/routes/` | Controller แยกฝั่งแอดมินและลูกค้า ไฟล์ route (`admin.php`, `customer.php`) กำหนด `action => [HTTP method, controller, handler]` ที่เดียว เพิ่ม action ใหม่ที่ไฟล์นี้โดยไม่ต้องแก้ `Core/Api.php` |
| `backend/src/Models/`, `backend/src/Services/` | repository ฐานข้อมูล (ตารางภาพเว็บไซต์ตั้งค่าใน `WebsiteImageRepository::COLLECTIONS` สร้างด้วย `WebsiteImageRepository::for()` ส่วนกติกาตามระดับลูกค้าอยู่ใน `PromotionLevelImageRepository`), session (`Path=/admin`), ตรวจบัญชี และจัดการรูปสินค้า/รูปเว็บไซต์ |
| `backend/src/Core/`, `backend/src/Middleware/` | API path router, `Cors`, `Csrf`, `HostGuard`, PDO_SQLSRV และ PHP dotenv |
| `deploy/`, `public/{api,admin,customer}/web.config`, `public/{api,admin,customer}/.htaccess` | การตั้งค่า 4-Domain Routing บน Apache, IIS FastCGI และ PHP built-in server |

Frontend แยกเป็น Static Site (`public/customer/` สำหรับ `example.com` + `www.example.com` และ `public/admin/` สำหรับ `admin.example.com`) เรียก Backend API กลางที่ `api.example.com` (`public/api/`) ผ่าน CORS + CSP `connect-src` ที่กำหนดจาก `VITE_API_BASE_URL` ตอน build (`pnpm --dir frontend build`)

## สัญญาของ API และฐานข้อมูล

| คำขอไปที่ `api.php` | การทำงาน |
| --- | --- |
| `GET ?action=session` | คืน `{ user, csrf, demo }` โดย `user` เป็น `{ username }` หรือ `null` |
| `POST ?action=login` | รับ JSON `{ username, password }` และ `X-CSRF-Token` แล้วคืนข้อมูล Session ชุดใหม่เมื่อสำเร็จ |
| `POST ?action=logout` | ใช้ `X-CSRF-Token` และคืน Session ที่ออกจากระบบแล้ว |
| `GET ?action=products&q=...&type=...&unit=...&page=...` | ใช้ Session ที่เข้าสู่ระบบแล้ว คืน `{ items, page, pageSize, total, totalPages }` โดยกรองประเภทและหน่วยเมื่อระบุ |
| `GET ?action=product-types` | ใช้ Session อ่านชื่อประเภทไม่ซ้ำจาก `dbo.Type` |
| `GET ?action=product-units` | ใช้ Session อ่านชื่อหน่วยไม่ซ้ำจาก `dbo.Unit` |
| `POST ?action=update-price` | ใช้ Session และ CSRF รับ `id`, `expectedPrice`, `price` และบันทึกเมื่อราคาเดิมยังตรงกัน |
| `GET ?action=product-images&id=...` | ใช้ Session อ่านสถานะรูปสองช่องของสินค้า |
| `GET ?action=product-image&id=...&slot=...` | ใช้ Session อ่านรูปสินค้าในช่อง 1 หรือ 2 |
| `GET ?path=...` | อ่านรูปโดยไม่ต้องเข้าสู่ระบบ เฉพาะ path ปัจจุบันที่อ้างอิงใน `Trade_Image1` หรือ `Trade_Image2` |
| `POST ?action=upload-product-image` | ใช้ Session และ CSRF รับ multipart `id`, `slot`, `expected`, `image` บันทึกรูปเมื่อ path เดิมยังตรงกัน |

- การยืนยันตัวตนใช้ `SUser` ตาม collation ของฐานข้อมูล และเปรียบเทียบ `SPass` แบบตรงตัวใน SQL Server คืนเฉพาะชื่อผู้ใช้ ห้ามส่งรหัสผ่านออกทาง API หรือบันทึกลง log
- ใช้คำสั่ง SQL แบบ prepared statements สำหรับค่าจากผู้ใช้ รักษาการเปลี่ยน Session ID เมื่อ Login หรือ Logout การหมดอายุเมื่อไม่มีการใช้งาน 30 นาที และการตอบ `429` พร้อม `Retry-After` เมื่อถูกจำกัดความถี่
- ใน `dbo.Trade` ใช้ `Trade_Id` เป็นคีย์และรหัสสินค้า `Trade_Name` เป็นชื่อ `Type_Name` เป็นประเภท `Unit_Name` เป็นหน่วย และ `Sale_Price1` เป็นราคาขาย อ่านรายละเอียดการจับคู่ใน `.env.example`
- รูปสินค้าเก็บนอก document root ใน `storage/product-images/<รหัสสินค้า>/` และบันทึก `<รหัสสินค้า>/<ชื่อไฟล์>` ใน `Trade_Image1`, `Trade_Image2` แยกรูป demo ใน `var/demo/product-images/`
- ผลลัพธ์สินค้าใช้คีย์ `id`, `code`, `name`, `barcode`, `category`, `unit`, `price` ค่าจากฐานส่งเป็น string หรือ `null` ตาราง ปัจจุบันไม่มีคอลัมน์บาร์โค้ดแยก การค้นหาใช้ชื่อและรหัสเป็นค่าเริ่มต้น แบ่งหน้า 15 รายการโดยเรียงลำดับตามรหัสและคีย์สินค้า
- เก็บค่าลับใน `.env` นอก document root อ้างอิงชื่อค่าตั้งจาก `.env.example` และใช้บัญชีบริการตามสิทธิ์ใน `database/grant-read.sql` และ `database/grant-price-update.sql` การทดสอบที่ต้องสร้างข้อมูลให้ใช้ `APP_MODE=demo` กับ SQLite ใน `var/demo`

## ตรวจงานก่อนส่ง

รันคำสั่งตามส่วนที่แก้จากรากโปรเจกต์ Backend ใช้ PHP 8.5 และ Composer ส่วน frontend ใช้ Node.js และ pnpm

```powershell
composer --working-dir=backend test
composer --working-dir=backend analyse
pnpm --dir frontend test
pnpm --dir frontend build
```

- เมื่อแก้ Login หรือรายการสินค้า ให้ทดสอบตั้งแต่หน้าเว็บถึง API ด้วยข้อมูลตัวอย่าง ครอบคลุมการปฏิเสธผู้ใช้ที่ยังไม่เข้าสู่ระบบ การค้นหาภาษาไทย การแบ่งหน้า และ Logout
- เมื่อแก้การเชื่อมต่อหรือ SQL และเข้าถึงฐานข้อมูลจริงได้ ให้ใช้ `php backend/bin/check-database.php` ตรวจการอ่านข้อมูลและการปฏิเสธบัญชีที่ไม่มีอยู่ แยกผลตรวจจากข้อมูลตัวอย่างกับผลตรวจฐานข้อมูลจริงในรายงานส่งงาน
