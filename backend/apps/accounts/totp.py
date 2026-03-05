"""
TOTP (Time-based One-Time Password) — RFC 6238 + RFC 4226
Czysta implementacja Python stdlib, bez zewnetrznych zaleznosci.
"""
import base64
import hashlib
import hmac
import os
import struct
import time
import urllib.parse


def generate_secret() -> str:
    """Generuje 20-bajtowy sekret zakodowany base32."""
    raw = os.urandom(20)
    return base64.b32encode(raw).decode('ascii')


def _hotp(secret_b32: str, counter: int) -> int:
    """HMAC-based OTP (RFC 4226)."""
    key = base64.b32decode(secret_b32.upper().replace(' ', ''))
    msg = struct.pack('>Q', counter)
    h = hmac.new(key, msg, hashlib.sha1).digest()
    offset = h[-1] & 0x0F
    code = struct.unpack('>I', h[offset:offset + 4])[0] & 0x7FFFFFFF
    return code % 1000000


def verify_totp(secret_b32: str, code: str, window: int = 1) -> bool:
    """
    Weryfikuje 6-cyfrowy kod TOTP.
    window=1 akceptuje +-1 okno 30-sekundowe (tolerancja zegara).
    """
    try:
        code_int = int(code.strip())
    except (ValueError, AttributeError):
        return False
    t = int(time.time()) // 30
    for delta in range(-window, window + 1):
        if _hotp(secret_b32, t + delta) == code_int:
            return True
    return False


def get_totp_uri(secret_b32: str, username: str, issuer: str = 'SobNet') -> str:
    """Generuje otpauth:// URI dla Google Authenticator / Aegis / etc."""
    label = urllib.parse.quote(f'{issuer}:{username}')
    params = urllib.parse.urlencode({
        'secret': secret_b32,
        'issuer': issuer,
        'algorithm': 'SHA1',
        'digits': '6',
        'period': '30',
    })
    return f'otpauth://totp/{label}?{params}'
