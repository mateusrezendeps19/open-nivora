import { createRoot } from 'react-dom/client';
import '../shared/styles/tokens.css';
import '../shared/styles/base.css';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('#root nao encontrado');

createRoot(container).render(<App />);
