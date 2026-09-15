# Tasks: impago-client-notice

## 1. Modelo (idempotencia)

- [ ] 1.1 `PaymentNotice { invoiceId @unique, kind, sentAt }` (o marcador equivalente en Activity)
- [ ] 1.2 `prisma db push` + `generate`

## 2. Webhook (Deno)

- [ ] 2.1 `invoice.payment_failed`: resolver FIRM_ADMIN de la firma; enviar email de impago; marcar por invoiceId (idempotente)
- [ ] 2.2 `invoice.paid`: si transición bloqueada→activa, enviar email de regularización
- [ ] 2.3 Plantillas Resend (impago / regularización) estilo AI-Office con enlace a /firm
- [ ] 2.4 Redeploy de la función (pedir confirmación)

## 3. Verificación

- [ ] 3.1 Simular impago (evento de prueba de Stripe) → email + tokens bloqueados
- [ ] 3.2 Reemitir el evento → no hay segundo email
- [ ] 3.3 `invoice.paid` tras bloqueo → email de regularización; cobro normal → sin email
