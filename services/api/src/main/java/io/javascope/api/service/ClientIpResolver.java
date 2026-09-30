package io.javascope.api.service;

import jakarta.servlet.http.HttpServletRequest;
import java.net.InetAddress;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public class ClientIpResolver {

  private static final Pattern IPV4_PATTERN =
      Pattern.compile(
          "^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$");

  public String resolveClientIp(HttpServletRequest request) {
    // 1. CF-Connecting-IP (from Cloudflare)
    String cfConnectingIp = request.getHeader("CF-Connecting-IP");
    if (isValidIp(cfConnectingIp)) {
      return cfConnectingIp.trim();
    }

    // 2. X-Forwarded-For
    String xForwardedFor = request.getHeader("X-Forwarded-For");
    if (xForwardedFor != null && !xForwardedFor.isBlank()) {
      String[] parts = xForwardedFor.split(",");
      for (String part : parts) {
        String candidate = part.trim();
        if (isValidIp(candidate)) {
          return candidate;
        }
      }
    }

    // 3. Fallback to direct remote address
    String remoteAddr = request.getRemoteAddr();
    if (isValidIp(remoteAddr)) {
      return remoteAddr.trim();
    }

    return "unknown";
  }

  private boolean isValidIp(String ip) {
    if (ip == null || ip.isBlank() || "unknown".equalsIgnoreCase(ip.trim())) {
      return false;
    }
    String trimmed = ip.trim();
    if (IPV4_PATTERN.matcher(trimmed).matches()) {
      return true;
    }
    try {
      InetAddress addr = InetAddress.getByName(trimmed);
      return addr != null;
    } catch (Exception e) {
      return false;
    }
  }
}
