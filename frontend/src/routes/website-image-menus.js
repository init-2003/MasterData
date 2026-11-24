export const promoBannerMenu = { id: 'promo-banner', title: 'ภาพแบนเนอร์โปรโมชัน' };
export const promoSaleMenu = { id: 'promo-sale', title: 'ภาพโปรโมชันลดราคา' };
export const carouselMenu = { id: 'carousel', title: 'ภาพสไลด์' };

export const websiteImageMenus = [promoBannerMenu, promoSaleMenu, carouselMenu];

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
