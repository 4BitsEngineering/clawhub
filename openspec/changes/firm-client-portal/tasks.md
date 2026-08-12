# Tasks: firm-client-portal

## 1. Portal

- [x] 1.1 Reescribir `src/app/firm/page.tsx`: layout AI-Office (navy + serif + amarillo + tarjetas crema), header propio (wordmark, firma, salir)
- [x] 1.2 Bloque instalador: botón de descarga a `/api/v0/installer`
- [x] 1.3 Bloque código: mostrar pairing activo más reciente (código mono + caducidad); action de generar (cuota + TTL 7 días); aviso de cuota agotada
- [x] 1.4 Bloque consumo: agregado del mes (tokens in+out, nº tareas) + mes anterior; sin costUsd
- [x] 1.5 Bloque facturación: action Billing Portal (customer desde stripeSubscriptionId, fallback stripeSessionId); tarjeta sin botón si no hay suscripción; try/catch con mensaje de soporte

## 2. Ocultar el resto

- [x] 2.1 `/firm/baselines`, `/firm/baselines/[id]`, `/firm/users`, `/firm/instances/[id]`, `/firm/mcp`, `/firm/settings`, `/firm/usage` → `redirect("/firm")`

## 3. Verificación

- [x] 3.1 Typecheck en verde
- [x] 3.2 Render como FIRM_ADMIN: portal con 4 bloques, sin enlaces operativos; subrutas redirigen
- [x] 3.3 Otros roles no afectados (operator/empresa/sales renderizan igual)
- [ ] 3.4 Prueba de facturación con la firma de una compra real (test) — **USUARIO** (requiere Billing Portal configurado en Stripe)

## 4. Documentación

- [x] 4.1 `openspec/funionales.md`: sección FIRM_ADMIN actualizada (portal de cliente)
- [x] 4.2 `ACCIONES-PENDIENTES.md`: prerequisito de configurar el Billing Portal en Stripe
