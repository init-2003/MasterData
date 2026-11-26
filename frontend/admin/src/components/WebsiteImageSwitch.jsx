import React from 'react';

export function WebsiteImageSwitch({ label, ...inputProps }) {
  return <label className="website-image-switch">
    <span className="website-image-switch-control">
      <input {...inputProps} type="checkbox" role="switch" />
      <span className="website-image-switch-track" aria-hidden="true" />
    </span>
    {label}
  </label>;
}
