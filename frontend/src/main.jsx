import React from 'react';
import { createRoot } from 'react-dom/client';
import 'sweetalert2/dist/sweetalert2.css';
import '@fontsource-variable/outfit/wght.css';
import '@fontsource-variable/noto-sans-thai/wght.css';
import './styles.css';
import { App } from './app/App.jsx';

createRoot(document.getElementById('root')).render(<App />);
