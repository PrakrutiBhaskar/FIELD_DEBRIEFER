async function applyRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous'
  const pathname = request.nextUrl.pathname

  if (!pathname.startsWith('/api/v1/')) return null

  try {
    let limiter = limiters.default
    if (pathname.startsWith('/api/v1/pattern')) limiter = limiters.pattern
    if (pathname.startsWith('/api/v1/upload')) limiter = limiters.upload

    const { success } = await limiter.limit(ip)

    if (!success) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' } },
        { status: 429 }
      )
    }
  } catch (err) {
    // Fail open — if Redis is unavailable, allow the request
    console.error('Rate limiter error:', err)
  }

  return null
}