# aioffice-brand-theme

## ADDED Requirements

### Requirement: Identidad AI-Office en todos los paneles
Los paneles de OPERATOR, EMPRESA y COMERCIAL y la pantalla de login SHALL usar la identidad visual AI-Office (lienzo navy, texto crema, titulares serif con punto amarillo, tarjetas crema con texto oscuro, acento amarillo), coherente con el portal del cliente.

#### Scenario: Paneles con el tema
- **WHEN** un usuario de cualquier rol abre su panel
- **THEN** ve el lienzo navy con header "AI Office" + chip del área y las tarjetas crema, con la misma paleta que `/firm`

#### Scenario: Login con el tema
- **WHEN** cualquiera abre `/login`
- **THEN** la pantalla usa el mismo lienzo y tarjeta crema

### Requirement: Sin regresión funcional ni de legibilidad
El cambio SHALL ser exclusivamente visual: ninguna página interior cambia su lógica ni su estructura, y los contenidos (tablas, formularios, estados) SHALL seguir siendo legibles dentro del nuevo tema.

#### Scenario: Página interior sin ediciones
- **WHEN** se renderiza una página interior existente (p. ej. `/empresa/commissions`)
- **THEN** hereda el tema del shell sin haberse modificado su código

#### Scenario: Zonas sin shell no afectadas
- **WHEN** se renderiza la landing pública o la success page
- **THEN** su estilo actual no cambia
