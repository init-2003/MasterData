import React from 'react';
import { WebsiteImageManager } from '../components/WebsiteImageManager.jsx';
import { promoSaleMenu } from '../routes/website-image-menus.js';

export function PromoSalePage(props) {
  return <WebsiteImageManager {...props} menu={promoSaleMenu} />;
}
