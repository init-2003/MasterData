import React from 'react';
import { WebsiteImageManager } from '../components/WebsiteImageManager.jsx';
import { promoBannerMenu } from '../routes/website-image-menus.js';

export function PromoBannerPage(props) {
  return <WebsiteImageManager {...props} menu={promoBannerMenu} />;
}
