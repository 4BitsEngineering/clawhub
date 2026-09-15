# Spec: campaigns-suite-branding

## ADDED Requirements

### Requirement: Remitente con el nombre de la Suite

Los correos de campaña de una Suite SHALL usar como remitente visible el nombre de la Suite sobre el dominio verificado compartido, saneando el nombre para evitar cabeceras inválidas.

#### Scenario: Correo de campaña de una Suite

- **WHEN** la Suite "Asesoría X" envía una campaña
- **THEN** el destinatario ve el remitente "Asesoría X <info@iaofi.com>"

#### Scenario: Nombre con caracteres peligrosos

- **WHEN** el nombre de la Suite contiene comas/comillas/saltos de línea
- **THEN** se sanean antes de construir la cabecera From

### Requirement: Envío grupal por selección o por estado

El sistema SHALL permitir enviar una campaña a los clientes seleccionados o a todos los que cumplan un estado, dentro de la Suite, con confirmación previa del recuento y sin reenviar a quien ya recibió esa campaña.

#### Scenario: Envío por estado

- **WHEN** el usuario elige "enviar a todos los NEW" de su Suite
- **THEN** ve el recuento de destinatarios, confirma, y se genera un CampaignSend por cliente NEW sin previo send de esa campaña

#### Scenario: Envío por selección

- **WHEN** el usuario marca 12 clientes y envía la campaña
- **THEN** se generan sends solo para esos 12 (los que no la habían recibido)

#### Scenario: Anti-duplicado

- **WHEN** se relanza la misma campaña sobre un público que ya la recibió
- **THEN** no se crean sends nuevos salvo que se pida reenvío explícito

#### Scenario: Aislamiento por Suite

- **WHEN** un usuario intenta enviar a clientes o con una campaña de otra Suite
- **THEN** el envío se rechaza
