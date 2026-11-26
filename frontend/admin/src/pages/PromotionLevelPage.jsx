import React from 'react';
import { WebsiteImageManager } from '../components/WebsiteImageManager.jsx';
import { promotionLevelMenu } from '../routes/website-image-menus.js';

export function PromotionLevelPage(props) {
  return <WebsiteImageManager {...props} menu={promotionLevelMenu} />;
}
