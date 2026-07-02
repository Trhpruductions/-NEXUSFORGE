import crypto from "node:crypto";

/**
 * Anonymizes an IP address by hashing it with a salt.
 * This prevents reversing the IP while still allowing for
 * deterministic identification for rate limiting or security audits.
 */
export function anonymizeIP(ip: string, salt: string = process.env.IP_ANONYMIZATION_SALT || 'nexusforge-default-salt'): string {
  if (!ip) return 'unknown';
  
  // Normalize IP (handle IPv6 loopback etc)
  const normalized = ip === '::1' || ip === '::ffff:127.0.0.1' ? '127.0.0.1' : ip;
  
  return crypto
    .createHash('sha256')
    .update(`${normalized}-${salt}`)
    .digest('hex');
}

/**
 * Returns a masked version of the IP for UI/Log display without hashing.
 * e.g. 192.168.1.1 -> 192.168.*.*
 */
export function maskIP(ip: string): string {
  if (!ip) return 'x.x.x.x';
  if (ip.includes(':')) {
    // IPv6 masking
    return ip.split(':').slice(0, 3).join(':') + ':xxxx:xxxx:xxxx';
  }
  return ip.split('.').slice(0, 2).join('.') + '.*.*';
}
