import React from 'react';
import { WebsiteImageManager } from '../components/WebsiteImageManager.jsx';
import { carouselMenu } from '../routes/website-image-menus.js';

export function CarouselPage(props) {
  return <WebsiteImageManager {...props} menu={carouselMenu} />;
}
