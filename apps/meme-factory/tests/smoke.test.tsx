import { render, screen } from '@testing-library/react'
import App from '@/App'

test('renders brand', () => {
  render(<App />)
  // The wordmark also appears in the logo, so target the hero heading itself.
  expect(screen.getByRole('heading', { name: '斗图军火库' })).toBeInTheDocument()
  expect(screen.getByText('别偷图了，造你自己的')).toBeInTheDocument()
})
