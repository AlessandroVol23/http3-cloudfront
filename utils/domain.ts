// Simplified domain configuration
export const ROOT_DOMAIN = 'volpee.de' // TODO: Change this to your domain

export function getDomain(stage: string): string {
  const baseDomain = {
    production: ROOT_DOMAIN,
    dev: `dev.${ROOT_DOMAIN}`
  }[stage] ?? `${stage}.dev.${ROOT_DOMAIN}`
  
  return baseDomain
}
