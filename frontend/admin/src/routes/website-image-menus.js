export const promoBannerMenu = { id: 'promo-banner', title: 'แบนเนอร์ต้อนรับ' };
export const promoSaleMenu = { id: 'promo-sale', title: 'โปรโมชันลดราคา' };
export const carouselMenu = { id: 'carousel', title: 'ภาพสไลด์' };
// Each image belongs to one customer level (Customer_Lavel) chosen from Customer_Type names.
export const promotionLevelMenu = { id: 'promotion-level', title: 'โปรโมชันตามระดับ', levels: true };

export const websiteImageMenus = [promoBannerMenu, promoSaleMenu, promotionLevelMenu, carouselMenu];

export function readActivePage(username) {
  try {
    const page = sessionStorage.getItem(`sptc.active-page.${username}`);
    if (websiteImageMenus.some(({ id }) => id === page)) return page;
  } catch { /* Use the default when storage is unavailable. */ }
  return 'products';
}

export function saveActivePage(username, page) {
  try {
    sessionStorage.setItem(`sptc.active-page.${username}`, page);
  } catch { /* Navigation remains available without storage. */ }
}
