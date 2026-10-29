import { render, screen } from '@testing-library/react'
import App from '@/App'

test('renders brand', () => {
  render(<App />)
  expect(screen.getByText('斗图军火库')).toBeInTheDocument()
  expect(screen.getByText('别偷图了，造你自己的')).toBeInTheDocument()
})
