/** 临时写死 token，后续改回 localStorage */
const HARDCODED_AUTH_TOKEN = "50253|F7xXpeqJZeMOk3uFHcs4a82dcEVLGNDYlp4jdFx8391800e6";

export function getAuthToken(): string {
  return HARDCODED_AUTH_TOKEN;
}
