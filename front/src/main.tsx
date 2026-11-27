import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './state/auth';
import { CartProvider } from './state/cart';
import { ThemeProvider } from './state/theme';
import './styles.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><ThemeProvider><AuthProvider><CartProvider><App /></CartProvider></AuthProvider></ThemeProvider></BrowserRouter></React.StrictMode>);
