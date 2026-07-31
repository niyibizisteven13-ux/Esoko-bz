import { auth } from '../firebase';
import { doc, getDoc, updateDoc } from '../services/firestoreBridge';

const db = undefined; // Used by firestoreBridge

// Dynamic domain detection for different environments
const getWebAuthnDomain = (): string => {
  const hostname = window.location.hostname;

  // Handle localhost development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return hostname;
  }

  // Production domains - extract root domain for better compatibility
  if (hostname.includes('.')) {
    const parts = hostname.split('.');
    // For domains like app.example.com, use example.com as rpId
    if (parts.length > 2) {
      return parts.slice(-2).join('.');
    }
  }

  return hostname;
};

export async function isBiometricSupported(): Promise<boolean> {
  // Check for native biometric APIs first
  if (window.navigator && 'credentials' in window.navigator) {
    try {
      const available =
        await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return available;
    } catch (e) {
      // Fallback to basic check
      return !!window.PublicKeyCredential;
    }
  }

  // Fallback for older browsers - assume supported if WebAuthn available
  return !!window.PublicKeyCredential;
}

export async function registerBiometric(): Promise<{ success: boolean; message: string }> {
  const user = auth.currentUser;
  if (!user) {
    return { success: false, message: 'Please log in first.' };
  }

  try {
    // Check if WebAuthn is supported
    if (!window.PublicKeyCredential) {
      return { success: false, message: 'WebAuthn is not supported on this browser.' };
    }

    // Check if platform authenticator is available
    const platformAvailable =
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!platformAvailable) {
      return { success: false, message: 'No fingerprint or face sensor found on this device.' };
    }

    // Create registration options
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userId = new Uint8Array(32);
    window.crypto.getRandomValues(userId);

    const createOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'eSoko Nexus',
        id: getWebAuthnDomain(),
      },
      user: {
        id: userId,
        name: user.email || user.id || 'user',
        displayName: user.name || user.email || 'User',
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
        { alg: -8, type: 'public-key' }, // Ed25519 (additional support)
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Prefer built-in sensors
        userVerification: 'required',
        requireResidentKey: false,
        residentKey: 'discouraged', // Don't require discoverable credentials
      },
      timeout: 60000,
      attestation: 'direct',
    };

    console.log('WebAuthn registration options:', createOptions);

    // Create the credential
    const credential = (await navigator.credentials.create({
      publicKey: createOptions,
    })) as PublicKeyCredential;

    if (!credential) {
      return { success: false, message: 'Biometric registration cancelled.' };
    }

    // Store the credential information
    const credentialData = {
      credentialId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
      publicKey: '', // Public key is handled server-side for security
      registeredAt: new Date().toISOString(),
    };

    // Update user document with biometric data
    await updateDoc(doc(db, 'users', user.uid || user.id), {
      biometricEnabled: true,
      biometricRegisteredAt: new Date().toISOString(),
      biometricData: credentialData,
    });

    return { success: true, message: 'Biometric authentication successfully registered!' };
  } catch (err: any) {
    console.error('Biometric registration failed:', err);

    if (err.name === 'NotAllowedError') {
      return { success: false, message: 'Biometric registration was cancelled or denied.' };
    } else if (err.name === 'SecurityError') {
      return { success: false, message: 'Security error during registration.' };
    } else if (err.name === 'NotSupportedError') {
      return { success: false, message: 'Biometric registration not supported.' };
    } else {
      return { success: false, message: 'Biometric registration failed. Please try again.' };
    }
  }
}

export async function authenticateBiometric(): Promise<{
  success: boolean;
  message: string;
  canRetry?: boolean;
}> {
  try {
    // Check if WebAuthn is supported
    if (!window.PublicKeyCredential) {
      return {
        success: false,
        message: 'Biometric authentication is not supported on this device. Please use your PIN.',
      };
    }

    // Check if platform authenticator is available (fingerprint/face sensor)
    const platformAvailable =
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!platformAvailable) {
      return {
        success: false,
        message: 'No fingerprint or face sensor found on this device. Please use your PIN.',
      };
    }

    // Get current user
    const user = auth.currentUser;
    if (!user) {
      return { success: false, message: 'Please log in first.' };
    }

    // Fetch user data from Firestore
    const userDocRef = doc(db, 'users', user.uid || user.id);
    const userDocSnap = await getDoc(userDocRef);
    const userData = userDocSnap.exists() ? userDocSnap.data() : null;

    // Check if user has registered biometric credentials
    const biometricData = userData?.biometricData;
    if (!biometricData?.credentialId) {
      return {
        success: false,
        message: 'No biometric credentials registered. Please set up biometrics in settings first.',
      };
    }

    // Create authentication options with the registered credential
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const options: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 30000, // Reduced timeout for better UX
      userVerification: 'required',
      rpId: getWebAuthnDomain(),
      allowCredentials: [
        {
          id: Uint8Array.from(atob(biometricData.credentialId), (c) => c.charCodeAt(0)),
          type: 'public-key',
          transports: ['internal', 'hybrid'], // Prioritize internal sensors, allow hybrid
        },
      ],
    };

    console.log('WebAuthn authentication options:', options);
    console.log('Domain:', getWebAuthnDomain());
    console.log('HTTPS:', window.location.protocol === 'https:');
    console.log('Platform authenticator available:', platformAvailable);

    // Try to authenticate
    const assertion = (await navigator.credentials.get({
      publicKey: options,
    })) as PublicKeyCredential;

    if (assertion) {
      console.log('Biometric authentication successful');
      return { success: true, message: 'Biometric authentication successful!' };
    } else {
      console.log('Biometric authentication returned no assertion');
      return { success: false, message: 'Biometric authentication failed. Please try again.' };
    }
  } catch (err: any) {
    console.error('Biometric authentication failed:', err);
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);

    // Handle specific error types with detailed user guidance
    if (err.name === 'NotAllowedError') {
      return {
        success: false,
        message:
          'Authentication was cancelled or timed out. Please try again and ensure you complete the biometric prompt.',
        canRetry: true,
      };
    } else if (err.name === 'SecurityError') {
      return {
        success: false,
        message:
          "Security error: Please ensure you're using HTTPS and check your browser permissions.",
        canRetry: false,
      };
    } else if (err.name === 'NotSupportedError') {
      return {
        success: false,
        message: 'Biometric authentication not supported on this device. Please use your PIN.',
        canRetry: false,
      };
    } else if (err.name === 'AbortError') {
      return {
        success: false,
        message: 'Authentication was interrupted. Please try again.',
        canRetry: true,
      };
    } else if (err.name === 'InvalidStateError') {
      return {
        success: false,
        message: 'No biometric credentials registered. Please set up biometrics in settings first.',
        canRetry: false,
      };
    } else if (err.name === 'ConstraintError') {
      return {
        success: false,
        message: 'Biometric sensor not available. Please check your device settings or use PIN.',
        canRetry: false,
      };
    } else {
      return {
        success: false,
        message: 'Biometric authentication failed. Please use your PIN as fallback.',
        canRetry: true,
      };
    }
  }
}

// Check if user has properly registered biometric credentials
export async function hasRegisteredCredentials(): Promise<boolean> {
  try {
    const user = auth.currentUser;
    if (!user) return false;

    const userDoc = await getDoc(doc(db, 'users', user.uid || user.id));
    const userData = userDoc.data();

    return !!(userData?.biometricEnabled && userData?.biometricData?.credentialId);
  } catch (error) {
    console.error('Error checking biometric credentials:', error);
    return false;
  }
}

// Get comprehensive biometric status for UI decisions
export async function getBiometricReadiness(): Promise<{
  supported: boolean;
  available: boolean;
  enrolled: boolean;
  canUseBiometrics: boolean;
  reason?: string;
}> {
  const supported = await isBiometricSupported();

  if (!supported) {
    return {
      supported: false,
      available: false,
      enrolled: false,
      canUseBiometrics: false,
      reason: 'WebAuthn not supported on this browser/device',
    };
  }

  let available = false;
  try {
    available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (error) {
    console.warn('Could not check platform authenticator availability:', error);
  }

  const enrolled = await hasRegisteredCredentials();

  const canUseBiometrics = supported && available && enrolled;

  let reason: string | undefined;
  if (!available) {
    reason = 'No fingerprint or face sensor detected on this device';
  } else if (!enrolled) {
    reason = 'Biometric authentication not set up yet';
  }

  return {
    supported,
    available,
    enrolled,
    canUseBiometrics,
    reason,
  };
}
