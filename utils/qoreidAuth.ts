interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

// In-memory cache for the module
let cachedToken: CachedToken | null = null;

export async function getQoreIdToken(): Promise<string> {
  const clientId = process.env.QOREID_CLIENT_ID;
  const secret = process.env.QOREID_SECRET_KEY;
  const authUrl = process.env.QOREID_AUTH_URL;

  if (!clientId || !secret || !authUrl) {
    console.error('[QoreID Auth] Missing required environment variables.');
    throw new Error('Authentication service is currently unavailable.');
  }

  // Objective 1: Implement Token Caching
  // Check if cache exists and is valid (with a 5-minute/300,000ms safety buffer)
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 300000) {
    return cachedToken.accessToken;
  }

  try {
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/plain',
      },
      body: JSON.stringify({
        clientId,
        secret,
      }),
    });

    if (response.status !== 201) {
      console.error(`[QoreID Auth] Request failed with status: ${response.status}`);
      throw new Error('Authentication service is currently unavailable.');
    }

    const textData = await response.text();
    
    let data;
    try {
      data = JSON.parse(textData);
    } catch {
      // If it's literally plain text, perhaps the token is the whole text.
      return textData; // Note: We wouldn't be able to cache expiry here without more info.
    }

    if (!data || !data.accessToken) {
      console.error('[QoreID Auth] Access token not found in the response payload.');
      throw new Error('Authentication service is currently unavailable.');
    }

    // Default to 1 hour (3600 seconds) if API doesn't return expiresIn
    const expiresInSeconds = data.expiresIn || 3600;

    // Update Cache
    cachedToken = {
      accessToken: data.accessToken,
      expiresAt: now + (expiresInSeconds * 1000),
    };

    return cachedToken.accessToken;
  } catch (error) {
    // We only log the error message securely, avoiding logging the body or config which might contain secrets.
    console.error('[QoreID Auth] Network or processing error:', error instanceof Error ? error.message : 'Unknown error');
    throw new Error('Authentication service is currently unavailable.');
  }
}
