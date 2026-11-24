USE [DBITManagement];
GO

-- The three website tables already exist. Run as a database administrator.
GRANT SELECT, INSERT, DELETE ON OBJECT::dbo.Web_Promo_Banner TO [sptc_master_web];
GRANT UPDATE ON OBJECT::dbo.Web_Promo_Banner (Promo_Title, Image_Url, Link_Url, Sort_Order, Is_Active, Updated_At) TO [sptc_master_web];
GRANT SELECT, INSERT, DELETE ON OBJECT::dbo.Web_Promo_Sale TO [sptc_master_web];
GRANT UPDATE ON OBJECT::dbo.Web_Promo_Sale (Promo_Title, Image_Url, Link_Url, Sort_Order, Is_Active, Updated_At) TO [sptc_master_web];
GRANT SELECT, INSERT, DELETE ON OBJECT::dbo.Web_Carousel TO [sptc_master_web];
GRANT UPDATE ON OBJECT::dbo.Web_Carousel (Slide_Title, Image_Url, Sort_Order, Is_Active, Updated_At) TO [sptc_master_web];
GO
