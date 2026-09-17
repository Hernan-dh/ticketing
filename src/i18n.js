const EN = {
  'Eventos':'Events','Ventas':'Sales','Control de acceso':'Access control','Integraciones':'Integrations','Mi marca':'My brand','Nuevo evento':'New event',
  'Tu espacio de trabajo':'Your workspace','Una plataforma.':'One platform.','Todas tus experiencias.':'All your experiences.','Web, boletería y mucho más.':'Web, box office, and much more.','Tu negocio, conectado.':'Your business, connected.','Espacio de demostración':'Demo workspace','Administrador':'Administrator','Demo local':'Local demo',
  'CADA GRAN EXPERIENCIA EMPIEZA ACÁ':'EVERY GREAT EXPERIENCE STARTS HERE','Tus eventos, sin límites':'Your events, without limits','Creá, vendé y conectá con tu público. Todo desde un solo lugar.':'Create, sell, and connect with your audience. All in one place.','Crear evento':'Create event',
  'TU MARCA. TU ESCENARIO.':'YOUR BRAND. YOUR STAGE.','Grandes momentos.':'Great moments.','Todo bajo tu control.':'Everything under your control.','Unificá tus canales de venta y hacé que cada':'Unify your sales channels and make every','entrada sea el comienzo de algo increíble.':'ticket the start of something incredible.','Explorar eventos':'Explore events','EXPERIENCIAS QUE CONECTAN':'EXPERIENCES THAT CONNECT',
  'Canales de venta':'Sales channels','Un solo negocio, todos los canales':'One business, every channel','Eventos publicados':'Published events','Listos para conectar con tu público':'Ready to connect with your audience','Medios de acceso':'Access methods','Digital, papel y RFID':'Digital, paper, and RFID','Próximas experiencias':'Upcoming experiences','Todo listo para tu próximo gran evento.':'Everything is ready for your next great event.','No encontramos eventos con esa búsqueda.':'No events match your search.','Publicado':'Published','Desde':'From','Hecho para crear experiencias extraordinarias.':'Built to create extraordinary experiences.',
  'Volver a eventos':'Back to events','Entradas emitidas':'Tickets issued','Pago simulado':'Simulated payment','¡Ya tenés tus entradas!':'Your tickets are ready!','Imprimir entradas':'Print tickets','Elegí tu lugar':'Choose your seat','Máximo 8 entradas':'Up to 8 tickets','Disponible':'Available','Tu selección':'Your selection','No disponible':'Unavailable','Selección accesible de asientos':'Accessible seat selection','Tu experiencia':'Your experience','Canal de venta':'Sales channel','Clave de operador':'Operator key','Asientos':'Seats','Sin seleccionar':'None selected','Reservar por 5 minutos':'Hold for 5 minutes','Reserva':'Hold','Correo del comprador':'Buyer email','Simular pago y emitir':'Simulate payment and issue','Elegir nuevamente':'Choose again','Modo demostración. No se realizan cobros reales.':'Demo mode. No real charges are made.','ENTRADA DEMO':'DEMO TICKET','Asiento':'Seat','ESCENARIO':'STAGE',
  'TU NEGOCIO, CONECTADO':'YOUR BUSINESS, CONNECTED','Gestioná tu operación desde un único espacio.':'Manage your operation from one workspace.','Ingresar / actualizar':'Sign in / refresh','Sesión verificada':'Session verified','Nombre':'Name','Lugar':'Venue','Fecha y hora':'Date and time','Precio ARS':'Price ARS','Filas':'Rows','Columnas':'Columns','Medio de acceso':'Access method','Papel':'Paper','Publicar evento':'Publish event',
  'Ventas de todos tus canales':'Sales from all channels','Ingresos demo':'Demo revenue','Entradas emitidas':'Tickets issued','Ingresos al evento':'Event check-ins','Comprador':'Buyer','Canal':'Channel','Pago':'Payment','Todavía no hay ventas. Emití una entrada desde Eventos.':'There are no sales yet. Issue a ticket from Events.','Ingresá tu clave para consultar las ventas.':'Enter your key to view sales.',
  'Validación online':'Online validation','Escaneá el código con un lector USB o pegá el token de la entrada.':'Scan the code with a USB reader or paste the ticket token.','Evento':'Event','Elegí un evento':'Choose an event','Código de entrada':'Ticket code','Validar ingreso':'Validate entry','Acceso permitido':'Access granted','Una entrada puede usarse una sola vez. RFID requiere conectar el lector y asociar su identificador.':'A ticket can only be used once. RFID requires connecting the reader and associating its identifier.',
  'Nombre de tu marca':'Your brand name','Color principal':'Primary color','Guardar identidad':'Save identity','Conectá tu ecosistema':'Connect your ecosystem','Registrá los proveedores que necesitás conectar. Esta demo guarda la intención; no conecta servicios externos ni almacena credenciales.':'Register the providers you need. This demo records the intent; it does not connect external services or store credentials.','Tipo':'Type','Proveedor':'Provider','Agregar':'Add','Pago':'Payment','Correo':'Email','Entrega':'Delivery','Beneficios':'Benefits','Sitio de venta':'Sales site',
  'Ver terminal del servidor':'See server terminal','Buscar eventos':'Search events','Buscar evento o lugar…':'Search event or venue…','Usá los botones de asientos debajo del plano.':'Use the seat buttons below the map.'
  ,'＋ Crear evento':'＋ Create event','Explorar eventos ↗':'Explore events ↗','✦ EXPERIENCIAS QUE CONECTAN':'✦ EXPERIENCES THAT CONNECT','● Publicado':'● Published','← Volver a eventos':'← Back to events','Entradas emitidas · Pago simulado':'Tickets issued · Simulated payment','Reservar por 5 minutos →':'Hold for 5 minutes →','Validar ingreso →':'Validate entry →','Reserva:':'Hold:','✓ Acceso permitido · Asiento':'✓ Access granted · Seat'
  ,'Demo: no se cobró ni se envió correo a':'Demo: no payment was collected and no email was sent to','Guardá tus entradas o imprimilas.':'Save or print your tickets.','Boletería':'Box office','Móvil':'Mobile','Distribuidor':'Distributor','Evento':'Event','Música':'Music','Conferencia':'Conference'
  ,'Ingresá la clave de operador.':'Enter the operator key.','Demasiadas solicitudes. Esperá un minuto.':'Too many requests. Wait one minute.','Servicio no disponible. Intentá nuevamente.':'Service unavailable. Try again.','Completá nombre, lugar y fecha válida.':'Enter a valid name, venue, and date.','Precio inválido.':'Invalid price.','El plano admite entre 1 y 20 filas y columnas.':'The map supports between 1 and 20 rows and columns.','Medio de acceso inválido.':'Invalid access method.','Evento inexistente.':'Event not found.','Canal inválido.':'Invalid channel.','Seleccioná entre 1 y 8 asientos válidos.':'Select between 1 and 8 valid seats.','Otro comprador tomó un asiento. Actualizá la selección.':'Another buyer took a seat. Refresh your selection.','La reserva venció. Volvé a elegir asientos.':'The hold expired. Choose your seats again.','Ingresá un correo válido.':'Enter a valid email.','Entrada inválida para este evento.':'Invalid ticket for this event.','Esta entrada ya fue utilizada.':'This ticket has already been used.'
};
const originals = new WeakMap();
const originalAttributes = new WeakMap();
const translateValue = (value, lang) => {
  if (lang === 'es') return value;
  const leading = value.match(/^\s*/)?.[0] || '', trailing = value.match(/\s*$/)?.[0] || '', core = value.trim();
  return EN[core] ? leading + EN[core] + trailing : value;
};
export function localize(root, lang) {
  document.documentElement.lang = lang;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    let value = originals.get(node);
    if (!value) {
      value = { source: node.nodeValue, rendered: node.nodeValue };
      originals.set(node, value);
    } else if (node.nodeValue !== value.rendered) {
      value.source = node.nodeValue;
    }
    value.rendered = translateValue(value.source, lang);
    if (node.nodeValue !== value.rendered) node.nodeValue = value.rendered;
  }
  root.querySelectorAll('[placeholder],[aria-label]').forEach(el => {
    if (!originalAttributes.has(el)) originalAttributes.set(el, {});
    for (const attr of ['placeholder','aria-label']) if (el.hasAttribute(attr)) {
      const values = originalAttributes.get(el); if (!values[attr]) values[attr] = el.getAttribute(attr);
      el.setAttribute(attr, translateValue(values[attr], lang));
    }
  });
}
export const locale = lang => lang === 'en' ? 'en-US' : 'es-AR';
