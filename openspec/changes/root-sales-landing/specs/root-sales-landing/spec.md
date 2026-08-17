# root-sales-landing

## ADDED Requirements

### Requirement: Landing de venta en la raíz
`/` SHALL mostrar a los visitantes sin sesión una landing de venta completa con la identidad AI-Office (hero, equipo de especialistas IA, cómo funciona, precios de ambas modalidades con las cuotas unificadas, FAQ y contacto), con los precios provenientes de la misma configuración (`LandingPage` de `/empresa/landing`). Los usuarios con sesión SHALL seguir siendo redirigidos a su panel.

#### Scenario: Visitante anónimo
- **WHEN** alguien abre la raíz sin sesión
- **THEN** ve la landing de venta con las cuotas vigentes y puede iniciar la compra

#### Scenario: Usuario con sesión
- **WHEN** un usuario logueado abre la raíz
- **THEN** es redirigido a su panel según rol (comportamiento actual)

### Requirement: Compra desde la raíz como venta de la casa
Las compras iniciadas desde la landing raíz SHALL registrarse con `Purchase.houseSale = true`, sin atribución a comercial: no SHALL generarse comisión y la compra no SHALL aparecer en "Compras sin atribuir" del panel de pagos. El resto del flujo post-compra (licencia, email, success page, portal del cliente) SHALL funcionar exactamente igual.

#### Scenario: Compra de la casa completa
- **WHEN** un visitante compra desde la raíz (cualquier modalidad)
- **THEN** la Purchase queda marcada houseSale, sin comisión, y el comprador recibe su licencia/onboarding normal

#### Scenario: No aparece en atribución manual
- **WHEN** el OPERATOR abre el panel de pagos con ventas de la casa completadas
- **THEN** esas compras no figuran en "Compras sin atribuir"

#### Scenario: Ingresos de empresa
- **WHEN** se consulta el dashboard de `/empresa`
- **THEN** las ventas de la casa suman en ingresos como cualquier otra compra

### Requirement: Checkout unificado compartido
La creación de la sesión de checkout SHALL estar centralizada en una única función reutilizada por `/oferta/[slug]` y la raíz, garantizando idéntico comportamiento (modalidades, cuotas, cupones, tarjeta, metadata).

#### Scenario: Paridad entre landings
- **WHEN** se compra el mismo plan desde `/` o desde `/oferta/ai-office`
- **THEN** la sesión de Stripe resultante es equivalente salvo la marca houseSale/tracking
