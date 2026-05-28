import { createRoot } from 'react-dom/client';
import RoutedApp from './ritual-app';
import './tokens.css';

createRoot(document.getElementById('root')!).render(<RoutedApp/>);
