import { redirect } from 'next/navigation'

// /chat without a matchId just redirects to the matches list
export default function ChatIndexPage() {
  redirect('/matches')
}
