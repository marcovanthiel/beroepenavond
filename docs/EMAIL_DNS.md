# E-mail (Resend) — DNS-records voor inijmegen.com

Afzender Beroepenavond: **noreply@inijmegen.com** via Resend. Voeg deze
records toe in Cloudflare (DNS-zone van inijmegen.com). DKIM/SPF horen publiek.

| Type | Naam | Waarde | Prioriteit |
|---|---|---|---|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDBZ5qUbGDOrHXelG2Rv7yEvJpWvJWmhhV46Gc3eEJG0KYuMCIp6ECcVOQgkt32cGEqULQ8eIMitS6vqJtRHdD3c9kaf7zGqS6DuARkE5OruVyRACI94HalJ4JzkNYcs71xudw7E84JuHn6YPcdeqx8g90Ocadm5gdq/WYOVY+N+wIDAQAB` | - |
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | - |

Resend domein-id: a2608f7b-55f0-4c3e-ac4a-19a897b28727 · status bij aanmaak: not_started

Na toevoegen: Resend verifieert automatisch (of klik "Verify"). Tot
verificatie worden inzendingen wel opgeslagen maar gaat er geen mail uit.
Worker-secret RESEND_API_KEY staat al; mail_from/mail_to/mail_enabled in settings.
