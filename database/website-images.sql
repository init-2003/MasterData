USE [DBITManagement];
GO

-- The website tables already exist. Run as a database administrator.
GRANT SELECT, INSERT, DELETE ON OBJECT::dbo.Web_Promo_WelCome TO [sptc_master_web];
GRANT UPDATE ON OBJECT::dbo.Web_Promo_WelCome (Promo_Title, Image_Url, Link_Url, Sort_Order, Is_Active, Updated_At) TO [sptc_master_web];
GRANT SELECT, INSERT, DELETE ON OBJECT::dbo.Web_Promo_Sale TO [sptc_master_web];
GRANT UPDATE ON OBJECT::dbo.Web_Promo_Sale (Promo_Title, Image_Url, Link_Url, Sort_Order, Is_Active, Updated_At) TO [sptc_master_web];
GRANT SELECT, INSERT, DELETE ON OBJECT::dbo.Web_Carousel TO [sptc_master_web];
GRANT UPDATE ON OBJECT::dbo.Web_Carousel (Slide_Title, Image_Url, Sort_Order, Is_Active, Updated_At) TO [sptc_master_web];
-- Promotion images per customer level (Customer_Lavel = code, Level_Name = Customer_Type at save time).
GRANT SELECT, INSERT, DELETE ON OBJECT::dbo.Web_Promotion_Level TO [sptc_master_web];
GRANT UPDATE ON OBJECT::dbo.Web_Promotion_Level (Remark, Image_Url, Customer_Lavel, Level_Name, Sort_Order, Is_Active, Updated_At) TO [sptc_master_web];
-- The level list only needs the two level columns of dbo.Customer.
GRANT SELECT ON OBJECT::dbo.Customer (Customer_Lavel, Customer_Type) TO [sptc_master_web];
GO
