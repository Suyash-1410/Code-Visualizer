package io.javascope.api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ClientIpResolverTest {

  private ClientIpResolver resolver;
  private HttpServletRequest request;

  @BeforeEach
  void setUp() {
    resolver = new ClientIpResolver();
    request = mock(HttpServletRequest.class);
  }

  @Test
  void testCfConnectingIpTakesPrecedence() {
    when(request.getHeader("CF-Connecting-IP")).thenReturn("198.51.100.42");
    when(request.getHeader("X-Forwarded-For")).thenReturn("203.0.113.19");
    when(request.getRemoteAddr()).thenReturn("10.0.0.1");

    assertEquals("198.51.100.42", resolver.resolveClientIp(request));
  }

  @Test
  void testXForwardedForMultiHop() {
    when(request.getHeader("CF-Connecting-IP")).thenReturn(null);
    when(request.getHeader("X-Forwarded-For")).thenReturn("203.0.113.19, 198.51.100.1, 10.0.0.2");
    when(request.getRemoteAddr()).thenReturn("10.0.0.1");

    assertEquals("203.0.113.19", resolver.resolveClientIp(request));
  }

  @Test
  void testInvalidXForwardedForFallsBack() {
    when(request.getHeader("CF-Connecting-IP")).thenReturn(null);
    when(request.getHeader("X-Forwarded-For")).thenReturn("malicious_spoofed_string");
    when(request.getRemoteAddr()).thenReturn("192.168.1.50");

    assertEquals("192.168.1.50", resolver.resolveClientIp(request));
  }

  @Test
  void testFallbackToRemoteAddr() {
    when(request.getHeader("CF-Connecting-IP")).thenReturn(null);
    when(request.getHeader("X-Forwarded-For")).thenReturn(null);
    when(request.getRemoteAddr()).thenReturn("172.16.0.5");

    assertEquals("172.16.0.5", resolver.resolveClientIp(request));
  }
}
