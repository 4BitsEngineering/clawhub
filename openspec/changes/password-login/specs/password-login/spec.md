# password-login

## ADDED Requirements

### Requirement: Login con email y contraseña
El sistema SHALL permitir iniciar sesión en `/login` con email + contraseña a los usuarios que tengan `passwordHash` asignado, creando una sesión JWT con su rol y firma. El magic link SHALL seguir disponible para todos los usuarios dados de alta.

#### Scenario: Credenciales correctas
- **WHEN** un usuario con contraseña asignada introduce su email y contraseña correcta
- **THEN** entra con sesión válida y aterriza en el panel de su rol

#### Scenario: Credenciales incorrectas o usuario sin contraseña
- **WHEN** la contraseña no coincide, el email no existe o el usuario no tiene contraseña asignada
- **THEN** se muestra un error genérico único ("Email o contraseña incorrectos") sin revelar cuál fue la causa

#### Scenario: Magic link intacto
- **WHEN** cualquier usuario dado de alta solicita el magic link
- **THEN** el flujo de magic link funciona igual que antes del cambio

### Requirement: Almacenamiento seguro de la contraseña
Las contraseñas SHALL almacenarse únicamente como hash scrypt con sal aleatoria por usuario, y la verificación SHALL usar comparación en tiempo constante. La contraseña en claro no SHALL persistirse ni registrarse en logs.

#### Scenario: Hash con sal única
- **WHEN** se asigna la misma contraseña a dos usuarios
- **THEN** sus hashes almacenados son distintos

### Requirement: Sesión JWT con datos de rol
La sesión SHALL usar estrategia JWT e incluir `id`, `role` y `firmId` del usuario, de modo que los guards existentes (`requireOperator`, `requireEmpresa`, `requireSalesRep`, `requireFirmAdmin`) sigan funcionando sin cambios.

#### Scenario: Guards intactos con ambos métodos de login
- **WHEN** un usuario entra por contraseña o por magic link
- **THEN** los paneles y restricciones por rol se comportan exactamente igual
