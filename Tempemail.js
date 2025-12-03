// Complete Temp Email System using mail.tm API
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname
  const apiBase = 'https://api.mail.tm'
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  }
  
  // Handle OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  // ============ GET AVAILABLE DOMAINS ============
  if (path === '/api/domains' && request.method === 'GET') {
    try {
      const response = await fetch(`${apiBase}/domains`)
      const data = await response.json()
      
      return new Response(JSON.stringify({
        success: true,
        domains: data['hydra:member'] || []
      }), { headers: corsHeaders })
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: "Failed to fetch domains"
      }), { 
        status: 500,
        headers: corsHeaders 
      })
    }
  }
  
  // ============ CREATE NEW ACCOUNT ============
  if (path === '/api/create' && request.method === 'POST') {
    try {
      const requestData = await request.json()
      const { address, password } = requestData
      
      // Create account
      const accountRes = await fetch(`${apiBase}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password })
      })
      
      if (!accountRes.ok) {
        const errorData = await accountRes.json()
        return new Response(JSON.stringify({
          success: false,
          error: errorData.message || 'Failed to create account'
        }), { 
          status: 400,
          headers: corsHeaders 
        })
      }
      
      // Get token
      const tokenRes = await fetch(`${apiBase}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password })
      })
      
      if (!tokenRes.ok) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to get authentication token'
        }), { 
          status: 400,
          headers: corsHeaders 
        })
      }
      
      const tokenData = await tokenRes.json()
      
      return new Response(JSON.stringify({
        success: true,
        email: address,
        token: tokenData.token,
        id: tokenData.id
      }), { headers: corsHeaders })
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: "Failed to create account"
      }), { 
        status: 500,
        headers: corsHeaders 
      })
    }
  }
  
  // ============ AUTO CREATE ACCOUNT (RANDOM) ============
  if ((path === '/api/new' || path === '/new') && request.method === 'GET') {
    try {
      // Get available domains
      const domainsRes = await fetch(`${apiBase}/domains`)
      const domainsData = await domainsRes.json()
      
      if (!domainsData['hydra:member'] || domainsData['hydra:member'].length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: "No domains available"
        }), { 
          status: 400,
          headers: corsHeaders 
        })
      }
      
      const domain = domainsData['hydra:member'][0].domain
      const randomString = Math.random().toString(36).substring(2, 10)
      const address = `${randomString}@${domain}`
      const password = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)
      
      // Create account
      const accountRes = await fetch(`${apiBase}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password })
      })
      
      if (!accountRes.ok) {
        const errorData = await accountRes.json()
        return new Response(JSON.stringify({
          success: false,
          error: errorData.message || 'Failed to create account'
        }), { 
          status: 400,
          headers: corsHeaders 
        })
      }
      
      // Get token
      const tokenRes = await fetch(`${apiBase}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password })
      })
      
      if (!tokenRes.ok) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to get authentication token'
        }), { 
          status: 400,
          headers: corsHeaders 
        })
      }
      
      const tokenData = await tokenRes.json()
      
      return new Response(JSON.stringify({
        success: true,
        email: address,
        token: tokenData.token,
        id: tokenData.id,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      }), { headers: corsHeaders })
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: "Failed to generate email"
      }), { 
        status: 500,
        headers: corsHeaders 
      })
    }
  }
  
  // ============ GET MESSAGES (INBOX) ============
  if (path === '/api/messages' && request.method === 'GET') {
    const token = url.searchParams.get('token')
    
    if (!token) {
      return new Response(JSON.stringify({
        success: false,
        error: "Authentication token required"
      }), { 
        status: 401,
        headers: corsHeaders 
      })
    }
    
    try {
      const page = url.searchParams.get('page') || 1
      const response = await fetch(`${apiBase}/messages?page=${page}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        return new Response(JSON.stringify({
          success: false,
          error: "Failed to fetch messages"
        }), { 
          status: 400,
          headers: corsHeaders 
        })
      }
      
      const data = await response.json()
      
      return new Response(JSON.stringify({
        success: true,
        messages: data['hydra:member'] || [],
        total: data['hydra:totalItems'] || 0,
        pages: Math.ceil((data['hydra:totalItems'] || 0) / 30)
      }), { headers: corsHeaders })
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: "Failed to fetch messages"
      }), { 
        status: 500,
        headers: corsHeaders 
      })
    }
  }
  
  // ============ GET SINGLE MESSAGE ============
  if (path.startsWith('/api/messages/') && request.method === 'GET') {
    const token = url.searchParams.get('token')
    const messageId = path.split('/').pop()
    
    if (!token || !messageId) {
      return new Response(JSON.stringify({
        success: false,
        error: "Token and message ID required"
      }), { 
        status: 400,
        headers: corsHeaders 
      })
    }
    
    try {
      const response = await fetch(`${apiBase}/messages/${messageId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        return new Response(JSON.stringify({
          success: false,
          error: "Failed to fetch message"
        }), { 
          status: 400,
          headers: corsHeaders 
        })
      }
      
      const message = await response.json()
      
      // Mark as read
      await fetch(`${apiBase}/messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/merge-patch+json'
        },
        body: JSON.stringify({ seen: true })
      })
      
      return new Response(JSON.stringify({
        success: true,
        message: message
      }), { headers: corsHeaders })
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: "Failed to fetch message"
      }), { 
        status: 500,
        headers: corsHeaders 
      })
    }
  }
  
  // ============ DELETE MESSAGE ============
  if (path.startsWith('/api/messages/') && request.method === 'DELETE') {
    const token = url.searchParams.get('token')
    const messageId = path.split('/').pop()
    
    if (!token || !messageId) {
      return new Response(JSON.stringify({
        success: false,
        error: "Token and message ID required"
      }), { 
        status: 400,
        headers: corsHeaders 
      })
    }
    
    try {
      const response = await fetch(`${apiBase}/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        return new Response(JSON.stringify({
          success: false,
          error: "Failed to delete message"
        }), { 
          status: 400,
          headers: corsHeaders 
        })
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: "Message deleted successfully"
      }), { headers: corsHeaders })
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: "Failed to delete message"
      }), { 
        status: 500,
        headers: corsHeaders 
      })
    }
  }
  
  // ============ DELETE ACCOUNT ============
  if (path === '/api/account' && request.method === 'DELETE') {
    const token = url.searchParams.get('token')
    
    if (!token) {
      return new Response(JSON.stringify({
        success: false,
        error: "Authentication token required"
      }), { 
        status: 401,
        headers: corsHeaders 
      })
    }
    
    try {
      // First get account ID
      const meRes = await fetch(`${apiBase}/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!meRes.ok) {
        return new Response(JSON.stringify({
          success: false,
          error: "Failed to get account info"
        }), { 
          status: 400,
          headers: corsHeaders 
        })
      }
      
      const meData = await meRes.json()
      
      // Delete account
      const deleteRes = await fetch(`${apiBase}/accounts/${meData.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!deleteRes.ok) {
        return new Response(JSON.stringify({
          success: false,
          error: "Failed to delete account"
        }), { 
          status: 400,
          headers: corsHeaders 
        })
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: "Account deleted successfully"
      }), { headers: corsHeaders })
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: "Failed to delete account"
      }), { 
        status: 500,
        headers: corsHeaders 
      })
    }
  }
  
  // ============ API DOCUMENTATION ============
  if (path === '/' || path === '/help' || path === '/api') {
    return new Response(JSON.stringify({
      api_name: "Temp Email API (mail.tm)",
      version: "1.0",
      endpoints: {
        "GET /api/domains": "Get available domains",
        "GET /api/new": "Create random email account",
        "POST /api/create": "Create custom email account",
        "GET /api/messages?token=TOKEN": "Get inbox messages",
        "GET /api/messages/:id?token=TOKEN": "Get specific message",
        "DELETE /api/messages/:id?token=TOKEN": "Delete message",
        "DELETE /api/account?token=TOKEN": "Delete account"
      },
      example_usage: {
        "create": "fetch('/api/new').then(res => res.json())",
        "inbox": "fetch('/api/messages?token=YOUR_TOKEN').then(res => res.json())"
      }
    }, null, 2), { 
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  // ============ 404 NOT FOUND ============
  return new Response(JSON.stringify({
    success: false,
    error: "Endpoint not found",
    available_endpoints: [
      "/api/domains",
      "/api/new",
      "/api/create",
      "/api/messages",
      "/api/messages/:id",
      "/help"
    ]
  }), { 
    status: 404,
    headers: corsHeaders 
  })
          }
