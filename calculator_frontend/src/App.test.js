import { render, screen } from '@testing-library/react';
import App from './App';

test('renders calculator display and equals button', () => {
  render(<App />);

  // Display should start at 0.
  expect(screen.getByLabelText(/calculator display/i)).toHaveTextContent('0');

  // Basic UI control exists.
  expect(screen.getByRole('button', { name: '=' })).toBeInTheDocument();
});
