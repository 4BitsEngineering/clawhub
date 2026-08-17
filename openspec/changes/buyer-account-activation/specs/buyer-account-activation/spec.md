# Spec: buyer-account-activation

## ADDED Requirements

### Requirement: Enlace de activación en el email post-compra

El email de licencia SHALL incluir un enlace de activación de cuenta de un solo uso (caducidad 7 días) cuando el usuario FIRM_ADMIN de la compra no tenga contraseña establecida. Nunca se envían contraseñas por email.

#### Scenario: Compra nueva

- **WHEN** se completa una compra y el comprador no tenía cuenta con contraseña
- **THEN** el email de licencia incluye el botón "Activa tu cuenta" con token de un solo uso

#### Scenario: Comprador con cuenta ya activa

- **WHEN** el comprador ya tiene contraseña (recompra o usuario existente)
- **THEN** el email no incluye bloque de activación (puede entrar por /login)

### Requirement: Página /activar con alta de contraseña

`/activar?token=` SHALL validar el token (existente, no usado, no caducado, usuario sin contraseña) y permitir establecer contraseña (mín. 8 caracteres, confirmación). Al completarse, el token queda usado y el cliente puede entrar por `/login`.

#### Scenario: Activación correcta

- **WHEN** el cliente abre un enlace válido y establece su contraseña
- **THEN** el token se marca usado, la contraseña se guarda con scrypt y se le dirige al login con aviso de cuenta activada

#### Scenario: Token caducado o usado

- **WHEN** el enlace no es válido
- **THEN** se muestra un mensaje claro y un formulario de reenvío por email

### Requirement: Reenvío del enlace de activación

El formulario de reenvío SHALL responder de forma neutra (sin revelar si la cuenta existe), reenviar solo a usuarios FIRM_ADMIN sin contraseña, invalidar tokens anteriores y aplicar rate-limit por IP.

#### Scenario: Reenvío legítimo

- **WHEN** un comprador antiguo sin contraseña pide el enlace desde /activar (o el acceso desde /login)
- **THEN** recibe un email nuevo con token fresco y los tokens previos quedan invalidados
