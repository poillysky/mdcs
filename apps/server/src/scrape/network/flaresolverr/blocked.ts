/** CF / 边缘封锁 / 空壳页 / 站方封 IP */

export function looksBlockedHtml(html: string | null | undefined): boolean {
  const s = String(html || "");
  if (s.length < 400) return true;
  return /Just a moment|cf-browser-verification|Attention Required|Edge IP Restricted|Cloudflare has blocked|403 ERROR|The request could not be satisfied|Access Denied|Please enable cookies|banned your access|禁止了你的訪問|異常行為|Web server is returning an unknown error|520:\s*Web server/i.test(
    s.slice(0, 4000),
  );
}
