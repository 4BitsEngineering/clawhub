# Tasks: campaigns-suite-branding

## 1. Remitente por Suite

- [ ] 1.1 `sendEmail`: aceptar display name; construir `"<suite.name> <baseFrom>"` con sanitize
- [ ] 1.2 Reply-To al email de contacto de la Suite (si se confirma en diseño)
- [ ] 1.3 El pipeline de CampaignSend de email usa el remitente de la Suite

## 2. Envío grupal

- [ ] 2.1 Checkboxes + acción "Enviar campaña" en la tabla de clientes de la Suite
- [ ] 2.2 Server action: `campaignId` + (clienteIds | status); resolver público; validar Suite
- [ ] 2.3 Anti-duplicado (excluir clientes con send previo de esa campaña; flag resend)
- [ ] 2.4 Confirmación con recuento previo; envío en lotes con fallidos a Activity/log

## 3. Scope

- [ ] 3.1 Campañas y envíos scoped a suiteId; anti-IDOR en server actions

## 4. Verificación

- [ ] 4.1 `tsc` + render de la tabla con selección y del diálogo de confirmación
- [ ] 4.2 Envío por estado y por selección (recuentos, anti-duplicado)
- [ ] 4.3 Remitente correcto en un envío real (cabecera From con el nombre de la Suite)
