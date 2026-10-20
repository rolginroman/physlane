/** Mirrors @better-auth/oauth-provider signed-query helpers for browser OAuth pages. */

const signedQueryParameterNameParam = "ba_param";

function getSignedOAuthQueryParameterNames(
  params: URLSearchParams,
): Set<string> | undefined {
  const signedParameterNames = params.getAll(signedQueryParameterNameParam);
  if (!signedParameterNames.length) return undefined;
  return new Set(signedParameterNames);
}

/** Signed OAuth continuation params from the current page URL (excludes unrelated query keys). */
export function buildSignedOAuthQuery(search: string): string | undefined {
  const params = new URLSearchParams(search);
  if (!params.has("sig")) return undefined;
  const signedParameterNames = getSignedOAuthQueryParameterNames(params);
  if (!signedParameterNames) return undefined;
  const signedParams = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    if (
      key === "sig" ||
      key === signedQueryParameterNameParam ||
      signedParameterNames.has(key)
    ) {
      signedParams.append(key, value);
    }
  }
  return signedParams.toString();
}

export function hasOAuthContinuation(search: string): boolean {
  return buildSignedOAuthQuery(search) !== undefined;
}
