export function validateLinkedInProfileUrl(input) {
  if (typeof input !== "string" || input.length > 2_048) return null;

  let url;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || url.username || url.password) return null;

  const host = url.hostname.toLowerCase();
  if (host !== "linkedin.com" && host !== "www.linkedin.com") return null;
  if (url.port || url.search || url.hash) return null;

  const match = url.pathname.match(/^\/in\/([^/]+)\/?$/i);
  if (!match || !/^[a-z0-9][a-z0-9_-]*$/i.test(match[1])) return null;

  return `https://www.linkedin.com/in/${match[1]}/`;
}
