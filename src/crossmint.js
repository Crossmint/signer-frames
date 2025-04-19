/**
 * Crossmint API Client Module
 * 
 * This module handles communications with the Crossmint API and exposes
 * functions for fetching shards, creating signers, sending OTPs, and
 * fetching attestations.
 */

/**
 * Fetch a shard from the Crossmint API
 * @param {Object} options - Options for fetching the shard
 * @param {string} options.projectId - The project ID
 * @param {string} options.shardId - The shard ID to fetch
 * @returns {Promise<Object>} The shard data
 */
export async function fetchShard({ projectId, shardId }) {
  if (!projectId) {
    throw new Error('Project ID is required to fetch shard');
  }
  
  if (!shardId) {
    throw new Error('Shard ID is required to fetch shard');
  }
  
  try {
    const response = await fetch(`https://api.crossmint.com/api/v1/projects/${projectId}/shards/${shardId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(`Failed to fetch shard: ${response.status} ${response.statusText} ${errorData ? JSON.stringify(errorData) : ''}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching shard:', error);
    throw error;
  }
}

/**
 * Create a signer through the Crossmint API
 * @param {Object} options - Options for creating the signer
 * @param {string} options.projectId - The project ID
 * @param {string} options.email - User's email address
 * @param {string} [options.chain='solana'] - The blockchain (solana, ethereum, etc.)
 * @returns {Promise<Object>} The created signer details
 */
export async function createSigner({ projectId, email, chain = 'solana' }) {
  if (!projectId) {
    throw new Error('Project ID is required to create signer');
  }
  
  if (!email) {
    throw new Error('Email is required to create signer');
  }
  
  try {
    const response = await fetch(`https://api.crossmint.com/api/v1/projects/${projectId}/signers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        chain,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(`Failed to create signer: ${response.status} ${response.statusText} ${errorData ? JSON.stringify(errorData) : ''}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating signer:', error);
    throw error;
  }
}

/**
 * Send a one-time password to the user's email
 * @param {Object} options - Options for sending the OTP
 * @param {string} options.projectId - The project ID
 * @param {string} options.email - User's email address
 * @param {string} [options.signerId] - Optional signer ID to link the OTP
 * @returns {Promise<Object>} The result of the OTP sending operation
 */
export async function sendOtp({ projectId, email, signerId }) {
  if (!projectId) {
    throw new Error('Project ID is required to send OTP');
  }
  
  if (!email) {
    throw new Error('Email is required to send OTP');
  }
  
  try {
    const payload = { email };
    
    if (signerId) {
      payload.signerId = signerId;
    }
    
    const response = await fetch(`https://api.crossmint.com/api/v1/projects/${projectId}/otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(`Failed to send OTP: ${response.status} ${response.statusText} ${errorData ? JSON.stringify(errorData) : ''}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw error;
  }
}

/**
 * Fetch an attestation from the Crossmint API
 * @param {Object} options - Options for fetching the attestation
 * @param {string} options.projectId - The project ID
 * @param {string} options.attestationId - The attestation ID to fetch
 * @returns {Promise<Object>} The attestation data
 */
export async function fetchAttestation({ projectId, attestationId }) {
  if (!projectId) {
    throw new Error('Project ID is required to fetch attestation');
  }
  
  if (!attestationId) {
    throw new Error('Attestation ID is required to fetch attestation');
  }
  
  try {
    const response = await fetch(`https://api.crossmint.com/api/v1/projects/${projectId}/attestations/${attestationId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(`Failed to fetch attestation: ${response.status} ${response.statusText} ${errorData ? JSON.stringify(errorData) : ''}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching attestation:', error);
    throw error;
  }
} 