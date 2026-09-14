# Ticketing

MVP de ticketing con interfaz en español, identidad configurable, catálogo de eventos, plano de asientos, reservas de cinco minutos, emisión de QR y validación online de uso único. Incluye dos modos: demo local ejecutable con Node.js y configuración del stack completo con Grails, MySQL y Redis.

## Ejecutar la demo en Windows

Requiere Node.js 22 o superior. Desde PowerShell:

```powershell
cd C:\Projects\ticketing
npm.cmd install
$env:ALLOW_DEMO_PAYMENTS = 'true'
npm.cmd run dev
```

Abrir http://localhost:5173. El servidor muestra una **clave de operador temporal** en la terminal. Ingresarla en Ventas, Control de acceso, Mi marca o Integraciones y pulsar “Ingresar / actualizar”. Para definir una clave persistente, establecer `ADMIN_KEY` antes de arrancar. La clave se guarda en sessionStorage de la pestaña; no incluirla en código ni compartirla con compradores.

La demo persiste en `data/state.json`. Ejecutar una sola instancia en este modo. Grails, MySQL y Redis no intervienen en la demo local. `.env` se usa por Docker Compose; para npm se emplean variables del proceso como en el ejemplo.

### Recorrido

1. Abrir un evento y seleccionar hasta ocho asientos en PixiJS o en la selección accesible.
2. Reservar; los asientos quedan bloqueados para los cuatro canales durante cinco minutos.
3. Ingresar correo y pulsar **Simular pago y emitir**. No se realizan cobros ni envíos de correo.
4. Guardar o imprimir las entradas. El QR contiene un token aleatorio de 256 bits.
5. En Control de acceso, autenticar al operador, elegir el evento y pegar el token o usar un lector USB de QR que ingrese texto. El primer ingreso se acepta; un segundo se rechaza.
6. Consultar Ventas, cambiar nombre/color de marca o crear un evento con filas, columnas, precio y medio de acceso.

## Stack completo

Requiere Docker con Compose. La imagen de Grails compila con JDK 17 y Gradle 8.14.3. **La compilación de Grails y el arranque de Compose no se verificaron en el entorno de creación, que no dispone de Java ni Docker.**

```powershell
Copy-Item .env.example .env
# Reemplazar las cuatro claves por valores aleatorios alfanuméricos distintos.
docker compose up --build
```

Abrir http://localhost:3001. La primera compilación puede demorar. El catálogo puede responder “Servicio no disponible” hasta que Grails termine de iniciar; actualizar la página. MySQL y Redis no publican puertos al host. Compose publica la app únicamente en loopback. `ALLOW_DEMO_PAYMENTS=true` habilita emisión simulada; deshabilitarlo bloquea checkout hasta implementar un gateway real.

| Tecnología | Responsabilidad |
|---|---|
| React | Catálogo, compra, operación, marca e integraciones |
| PixiJS 8 | Renderizado y selección del plano de asientos |
| Backbone.js | Modelo observable de selección de asientos |
| Node.js / Express | API de reservas, emisión, autorización y check-in |
| Grails 7 | Servicio de catálogo, creación y validación de eventos en MySQL |
| MySQL 8.4 | Catálogo y persistencia transaccional de inventario, ventas y entradas |
| Redis 7.4 | Limitación de solicitudes por IP |

Grails mantiene `catalog_events`; Node sincroniza el catálogo al consultarlo. Los eventos no se editan ni eliminan en este MVP para evitar alterar ventas existentes. Las reservas, órdenes, entradas e identidad viven en una fila JSON `ticketing_state`. `SELECT ... FOR UPDATE` serializa las operaciones, también entre instancias Node. Es una implementación inicial deliberadamente simple: limita el rendimiento y debe migrarse a tablas normalizadas por evento antes de una carga comercial. Redis no determina la disponibilidad ni la validez de una entrada.

## Alcance y pendientes

| Característica | Estado |
|---|---|
| Canales web, boletería, móvil y distribuidor | Mismo inventario y registro del canal; los tres últimos requieren clave de operador |
| Marca | Nombre y color configurables, una marca por instalación |
| Tickets digitales y papel | QR descargable mediante impresión del navegador |
| RFID | Medio registrado; falta asociación UID, integración de lector y protocolo seguro del hardware |
| Asientos numerados | Plano rectangular configurable hasta 20 × 20; falta editor libre de recintos y sectores |
| Control de acceso | Token aleatorio, evento obligatorio y uso único atómico; requiere conexión |
| Pagos | Simulados; faltan proveedor, webhooks firmados, conciliación, devoluciones e idempotencia del gateway |
| Correos, entregas, beneficios, sitios de venta | Registro de proveedores pendientes; faltan adaptadores, credenciales, ejecución y reintentos |
| Seguridad y usuarios | Clave compartida de operador para demo; faltan usuarios, roles por organización, sesiones, auditoría y aislamiento multiempresa |

No es una plataforma comercial terminada. Antes de producción: completar pendientes, modelar impuestos/comisiones y zonas horarias, normalizar datos y migraciones, proteger reservas públicas contra abuso, configurar TLS, secretos, copias de seguridad, observabilidad y pruebas de carga. Un QR copiado sigue siendo una credencial portadora: el sistema acepta al primero y rechaza los usos siguientes; no garantiza que quien lo presenta sea su dueño. No almacenar números de tarjeta.

## API

Operaciones de operador requieren `x-admin-key`. El servicio Grails exige `X-Service-Key` y sólo es accesible dentro de la red Compose.

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/health` | Estado y modo de almacenamiento |
| GET / POST | `/api/events` | Listar / crear (operador) |
| GET | `/api/events/:id/seats` | Asientos vendidos y reservados |
| POST | `/api/holds` | `{eventId, seats, channel}` |
| POST | `/api/checkout` | `{holdId, email}`; idempotencia por reserva |
| POST | `/api/scan` | `{eventId, token}` (operador) |
| GET | `/api/admin` | Ventas y métricas (operador) |
| PUT | `/api/brand` | `{name, color}` (operador) |
| PUT | `/api/integrations` | `{provider, type}` (operador) |

## Verificación

```powershell
npm.cmd test
npm.cmd run build
# Verificación centralizada, changelog y hook local:
npm.cmd run verify
npm.cmd run docs:changelog
npm.cmd run hooks:install
# Prueba en Chrome instalado (servidor de desarrollo apagado):
npx.cmd playwright test
# Servir el bundle compilado:
$env:ALLOW_DEMO_PAYMENTS = 'true'
npm.cmd start
```

Las seis pruebas de Node cubren conflicto entre canales, vencimiento, precios del servidor, idempotencia, tokens falsos, evento equivocado, doble ingreso, validación de entradas, permisos HTTP, solicitudes concurrentes y persistencia tras reinicio. El test HTTP usa el puerto 3197 y un directorio temporal aislado. La prueba de Chrome verifica plano Pixi, compra, QR, acceso único, ausencia de errores JavaScript y ancho móvil; guarda capturas en `test-results/` y datos separados en `data/browser-*`. MySQL, Redis y Grails necesitan validación adicional en un entorno que los ejecute.

Referencias utilizadas: [Grails 7: configuración y migración](https://grails.apache.org/docs/7.0.2/guide/upgrading.html), [requisitos de Grails](https://grails.apache.org/docs/7.0.2/guide/gettingStarted.html), [Application de PixiJS 8](https://pixijs.com/8.x/guides/components/application).

## Documentación y commits

La documentación operativa se mantiene en [`docs/`](docs/). Los scripts de automatización están escritos en Python. `npm run docs:changelog` genera `CHANGELOG.md` desde el historial Git y `npm run docs:decision -- "Título"` crea una plantilla ADR numerada. `npm run hooks:install` activa la verificación antes de cada commit para este clon.

`npm run publish:preview` verifica el cambio y propone un commit convencional sin modificar Git. `npm run publish` muestra la propuesta y exige escribir `PUBLISH` antes de crear el commit y hacer push. Se puede proveer `--title` y `--description`; si se omiten, usa `GEMINI_API_KEY` local para generarlos. Más detalle en [`docs/OPERATIONS.md`](docs/OPERATIONS.md).
