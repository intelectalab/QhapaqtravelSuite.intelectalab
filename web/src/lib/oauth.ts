export const OAUTH_FIELDS = ["response_type", "client_id", "redirect_uri", "scope", "state", "code_challenge", "code_challenge_method"] as const;

export interface OAuthConsentData {
  client_id: string;
  name: string;
  vendor: string;
  agency: string;
  redirect_uri: string;
  state: string | null;
  scopes: { value: string; label: string }[];
}
