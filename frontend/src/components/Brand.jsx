import React from 'react';
import sidebarLogo from '../assets/sidebar-logo.jpg';

export function Brand({ light = false }) {
  return <div className={`brand${light ? ' brand-light' : ''}`}><img className="brand-logo" src={sidebarLogo} alt="" /><span>SPTC<span className="brand-dot">.</span></span></div>;
}
