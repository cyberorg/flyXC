export const Secrets = {
  GEONAMES: String(process.env['GEONAMES']),
  REDIS_URL: String(process.env['REDIS_URL']),
  GOOGLE_OAUTH_ID: String(process.env['GOOGLE_OAUTH_ID']),
  GOOGLE_OAUTH_SECRET: String(process.env['GOOGLE_OAUTH_SECRET']),
  // head /dev/urandom  tr -dc A-Za-z0-9  head -c 32 ; echo ''
  SESSION_SECRET: String(process.env['SESSION_SECRET']),
  FLYME_TOKEN: String(process.env['FLYME_TOKEN']),
  ADMINS: String(process.env['ADMINS']),
  PROXY_KEY: String(process.env['PROXY_KEY']),
  OPENAIP_KEY: String(process.env['OPENAIP_KEY']),
  AVIANT_URL: String(process.env['AVIANT_URL']),
  // https://www.george-smart.co.uk/aprs/aprs_callpass/
  APRS_USER: String(process.env['APRS_USER']),
  APRS_PASSWORD: String(process.env['APRS_PASSWORD']),
  ZOLEO_UNLINK_URL: String(process.env['ZOLEO_UNLINK_URL']),
  ZOLEO_UNLINK_API_KEY: String(process.env['ZOLEO_UNLINK_API_KEY']),
  ZOLEO_PUSH_USER: String(process.env['ZOLEO_PUSH_USER']),
  ZOLEO_PUSH_PWD: String(process.env['ZOLEO_PUSH_PWD']),
  XCONTEXT_JWT: String(process.env['XCONTEXT_JWT']),
  BUY_ME_A_COFFEE_TOKEN: String(process.env['BUY_ME_A_COFFEE_TOKEN']),
  FLYMASTER_GROUP_ID: String(process.env['FLYMASTER_GROUP_ID']),
  FLYMASTER_GROUP_TOKEN: String(process.env['FLYMASTER_GROUP_TOKEN']),
  MAILERSEND_TOKEN: String(process.env['MAILERSEND_TOKEN']),
  MESHBIR_AUTH_TOKEN: String(process.env['MESHBIR_AUTH_TOKEN']),
};
