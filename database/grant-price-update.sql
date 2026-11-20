USE [DBITManagement];
GO

-- Run by a database administrator after the read-only user has been created.
GRANT UPDATE ON OBJECT::dbo.Trade (Sale_Price1) TO [sptc_master_web];
GRANT UPDATE ON OBJECT::dbo.Trade (Trade_Image1, Trade_Image2) TO [sptc_master_web];
GRANT UPDATE ON OBJECT::dbo.Trade (Trade_Note) TO [sptc_master_web];
GRANT UPDATE ON OBJECT::dbo.Trade (Trade_Note_Sort) TO [sptc_master_web];
GO
