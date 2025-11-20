import { createRoot } from 'react-dom/client';

const ensureRootElement = () => {
  let element = document.getElementById('root');
  if (element) return element;
  element = document.createElement('div');
  element.id = 'root';
  element.style.display = 'none';
  document.body.appendChild(element);
  return element;
};

const root = createRoot(ensureRootElement());
root.render(null);
