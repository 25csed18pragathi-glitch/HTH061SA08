import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import './traffic.css';
import './starvation.css';
import './pedestrian.css';
import './emergency.css';
import { TrafficProvider } from './context/TrafficContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <TrafficProvider>
        <App />
      </TrafficProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
