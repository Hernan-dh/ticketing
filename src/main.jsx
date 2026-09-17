import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Backbone from "backbone";
import { Application, Graphics, Text } from "pixi.js";
import QRCode from "qrcode";
import "./style.css";
import { localize, locale } from "./i18n.js";
const selection = new Backbone.Model({ seats: [] });
const money = (n) =>
  new Intl.NumberFormat(locale(document.documentElement.lang), {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
const paymentName = (type, lang) => {
  const names = {
    card: ["Tarjeta", "Card"],
    bank_transfer: ["Transferencia", "Bank transfer"],
    wallet: ["Billetera", "Wallet"],
    cash: ["Efectivo", "Cash"],
  };
  return names[type]?.[lang === "en" ? 1 : 0] || type;
};
async function api(path, method = "GET", body) {
  const r = await fetch(`/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": sessionStorage.getItem("operator") || "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error);
  return data;
}
function SeatMap({ event, availability, seats, onSelect, lang }) {
  const host = useRef();
  useEffect(() => {
    let disposed = false,
      app;
    async function draw() {
      app = new Application();
      await app.init({
        width: 680,
        height: 440,
        backgroundAlpha: 0,
        antialias: true,
      });
      if (disposed) {
        app.destroy(true);
        return;
      }
      host.current.appendChild(app.canvas);
      const stage = new Graphics()
        .roundRect(170, 14, 340, 35, 8)
        .fill("#263d36");
      app.stage.addChild(stage);
      const title = new Text({
        text: lang === "en" ? "STAGE" : "ESCENARIO",
        style: { fontSize: 12, fill: "#b9d3c5", letterSpacing: 4 },
      });
      title.position.set(280, 24);
      app.stage.addChild(title);
      const size = Math.min(35, 560 / event.columns, 335 / event.rows),
        start = (680 - event.columns * size) / 2;
      for (let row = 0; row < event.rows; row++) {
        const label = new Text({
          text: String.fromCharCode(65 + row),
          style: { fill: "#8b9d94", fontSize: 12 },
        });
        label.position.set(start - 25, 85 + row * size);
        app.stage.addChild(label);
        for (let col = 0; col < event.columns; col++) {
          const id = `${String.fromCharCode(65 + row)}${col + 1}`,
            blocked =
              availability.sold.includes(id) || availability.held.includes(id);
          const g = new Graphics()
            .roundRect(0, 0, size - 9, size - 9, 5)
            .fill(
              blocked ? "#30453e" : seats.includes(id) ? "#d7fa76" : "#8fae9e",
            );
          g.position.set(start + col * size, 80 + row * size);
          g.eventMode = blocked ? "none" : "static";
          g.cursor = "pointer";
          g.on("pointertap", () => onSelect(id));
          app.stage.addChild(g);
        }
      }
    }
    draw().catch(() => {
      if (host.current)
        host.current.dataset.error =
          "Usá los botones de asientos debajo del plano.";
    });
    return () => {
      disposed = true;
      if (app?.renderer) app.destroy(true, { children: true });
    };
  }, [event, availability, seats, onSelect]);
  return <div className="canvas" ref={host} />;
}
function Ticket({ ticket, event }) {
  const [qr, setQr] = useState("");
  useEffect(() => {
    QRCode.toDataURL(ticket.token, { width: 180, margin: 1 }).then(setQr);
  }, [ticket]);
  return (
    <article className="ticket">
      <div>
        <span className="eyebrow">ENTRADA DEMO · {ticket.medium}</span>
        <h3>{event.name}</h3>
        <p>
          Asiento <strong>{ticket.seat}</strong> · {event.venue}
        </p>
        <code>{ticket.token}</code>
      </div>
      {qr && <img src={qr} alt={`QR de entrada ${ticket.seat}`} />}
    </article>
  );
}
function App() {
  const [lang, setLang] = useState(localStorage.getItem("language") || "es"),
    [page, setPage] = useState("Eventos"),
    [events, setEvents] = useState([]),
    [brand, setBrand] = useState({ name: "Ticketing", color: "#d7fa76" }),
    [query, setQuery] = useState(""),
    [event, setEvent] = useState(null),
    [seats, setSeats] = useState([]),
    [availability, setAvailability] = useState({ sold: [], held: [] }),
    [channel, setChannel] = useState("Web"),
    [hold, setHold] = useState(null),
    [order, setOrder] = useState(null),
    [buyerName, setBuyerName] = useState(""),
    [email, setEmail] = useState(""),
    [paymentMethod, setPaymentMethod] = useState("demo_card"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [admin, setAdmin] = useState(null),
    [customers, setCustomers] = useState(null),
    [revealed, setRevealed] = useState({}),
    [key, setKey] = useState(sessionStorage.getItem("operator") || ""),
    [token, setToken] = useState(""),
    [scanEvent, setScanEvent] = useState(""),
    [scanResult, setScanResult] = useState(null),
    [scanError, setScanError] = useState(""),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    localStorage.setItem("language", lang);
    localize(document.getElementById("root"), lang);
    const observer = new MutationObserver(() =>
      localize(document.getElementById("root"), lang),
    );
    observer.observe(document.getElementById("root"), {
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [lang]);
  const run = async (fn) => {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };
  const refresh = async () => {
    const d = await api("/events");
    setEvents(d.events);
    setBrand(d.brand);
  };
  useEffect(() => {
    run(refresh);
    const retry = setInterval(() => refresh().catch(() => {}), 15000);
    const changed = () => setSeats([...selection.get("seats")]);
    selection.on("change:seats", changed);
    return () => {
      clearInterval(retry);
      selection.off("change:seats", changed);
    };
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!event) return;
    let cancelled = false;
    const update = () =>
      api(`/events/${event.id}/seats`)
        .then((d) => {
          if (!cancelled) setAvailability(d);
        })
        .catch((e) => {
          if (!cancelled) setMessage(e.message);
        });
    update();
    const t = setInterval(update, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [event]);
  const choose = useCallback(
    (id) => {
      if (hold) return;
      const old = selection.get("seats");
      selection.set(
        "seats",
        old.includes(id)
          ? old.filter((s) => s !== id)
          : old.length < 8
            ? [...old, id]
            : old,
      );
    },
    [hold],
  );
  const open = (e) => {
    selection.set("seats", []);
    setHold(null);
    setOrder(null);
    setAvailability({ sold: [], held: [] });
    setEvent(e);
    setMessage("");
  };
  const login = () =>
    run(async () => {
      sessionStorage.setItem("operator", key);
      const [dashboard, customerData] = await Promise.all([
        api("/admin"),
        api("/customers"),
      ]);
      setAdmin(dashboard);
      setCustomers(customerData.customers);
    });
  const seconds = hold
    ? Math.max(0, Math.ceil((hold.expiresAt - now) / 1000))
    : 0;
  const checkoutSeats = hold ? hold.seats : seats;
  const checkoutTotal = hold
    ? hold.total
    : event
      ? seats.length * event.price
      : 0;
  return (
    <div className="shell" style={{ "--accent": brand.color }}>
      <aside>
        <a
          className="logo"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Eventos");
          }}
        >
          <span className="logo-icon">c</span>
          {brand.name.toLowerCase()}
          <sup>®</sup>
        </a>
        <div className="workspace">
          <span className="avatar">C</span>
          <div>
            {brand.name} Ticketing<small>Tu espacio de trabajo</small>
          </div>
          <span>⌄</span>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {[
            ["Eventos", "◫"],
            ["Ventas", "↗"],
            ["Clientes", "◎"],
            ["Control de acceso", "⌘"],
            ["Integraciones", "⊞"],
            ["Mi marca", "◈"],
          ].map(([p, i]) => (
            <button
              className={page === p ? "active" : ""}
              key={p}
              onClick={() => {
                setPage(p);
                setEvent(null);
                setMessage("");
              }}
            >
              <span>{i}</span>
              {p}
              {p === "Eventos" && <b>{events.length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help">
            <span>
              Una plataforma.
              <br />
              Todas tus experiencias.
            </span>
            <p>
              Web, boletería y mucho más.
              <br />
              Tu negocio, conectado.
            </p>
            <span className="mini-mark">↗</span>
          </div>
          <div className="profile">
            <span className="avatar">CT</span>
            <div>
              Espacio de demostración<small>Administrador</small>
            </div>
          </div>
        </div>
      </aside>
      <main>
        <header>
          <span>
            Workspace <span className="muted">/</span> <strong>{page}</strong>
          </span>
          <div>
            <button
              className="language-toggle"
              onClick={() => setLang(lang === "es" ? "en" : "es")}
              aria-label={
                lang === "es" ? "Switch to English" : "Cambiar a español"
              }
            >
              {lang === "es" ? "EN" : "ES"}
            </button>
            <span className="online-dot" /> Demo local{" "}
            <span className="header-avatar">CT</span>
          </div>
        </header>
        <div className="content">
          {message && (
            <div role="alert" className="alert">
              {message}
              <button onClick={() => setMessage("")}>×</button>
            </div>
          )}
          {page === "Eventos" && !event && (
            <>
              <div className="heading">
                <div>
                  <p className="eyebrow">CADA GRAN EXPERIENCIA EMPIEZA ACÁ</p>
                  <h1>
                    Tus eventos, sin límites<span>.</span>
                  </h1>
                  <p>
                    Creá, vendé y conectá con tu público. Todo desde un solo
                    lugar.
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => {
                    setPage("Nuevo evento");
                    setMessage("");
                  }}
                >
                  ＋ Crear evento
                </button>
              </div>
              <section className="hero">
                <div>
                  <span className="pill">TU MARCA. TU ESCENARIO.</span>
                  <h2>
                    Grandes momentos.
                    <br />
                    <em>Todo bajo tu control.</em>
                  </h2>
                  <p>
                    Unificá tus canales de venta y hacé que cada
                    <br />
                    entrada sea el comienzo de algo increíble.
                  </p>
                  <button
                    onClick={() =>
                      document
                        .getElementById("event-list")
                        .scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    Explorar eventos ↗
                  </button>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="orbit o1" />
                  <div className="orbit o2" />
                  <div className="big-ticket">
                    <span>LIVE EXPERIENCES</span>
                    <b>
                      MAKE
                      <br />
                      IT HAPPEN.
                    </b>
                    <div className="ticket-line" />
                    <small>
                      ADMIT ONE <span>↗</span>
                    </small>
                    <div className="barcode" />
                  </div>
                  <span className="spark">✳</span>
                  <span className="floating">✦ EXPERIENCIAS QUE CONECTAN</span>
                </div>
              </section>
              <section className="stats">
                {[
                  [
                    "Canales de venta",
                    "04",
                    "Un solo negocio, todos los canales",
                    "↗",
                  ],
                  [
                    "Eventos publicados",
                    String(events.length).padStart(2, "0"),
                    "Listos para conectar con tu público",
                    "◫",
                  ],
                  ["Medios de acceso", "03", "Digital, papel y RFID", "⌘"],
                ].map(([label, value, desc, icon]) => (
                  <article key={label}>
                    <div>
                      <span>{label}</span>
                      <i>{icon}</i>
                    </div>
                    <b>{value}</b>
                    <small>{desc}</small>
                  </article>
                ))}
              </section>
              <div className="list-heading" id="event-list">
                <div>
                  <h2>
                    Próximas experiencias <span>{events.length}</span>
                  </h2>
                  <p>Todo listo para tu próximo gran evento.</p>
                </div>
                <input
                  aria-label="Buscar eventos"
                  placeholder="⌕  Buscar evento o lugar…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="event-grid">
                {events
                  .filter((e) =>
                    `${e.name} ${e.venue}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((e, i) => (
                    <article className="event-card" key={e.id}>
                      <button
                        className={`poster ${e.accent}`}
                        onClick={() => open(e)}
                      >
                        <span className="poster-tag">{e.category}</span>
                        <span className="poster-type">{e.name}</span>
                        <span className="poster-symbol">
                          {["✳", "◉", "✦"][i % 3]}
                        </span>
                        <small>LIVE EXPERIENCES / 2026</small>
                      </button>
                      <div className="event-info">
                        <span className="event-date">
                          {new Date(e.date).toLocaleDateString(locale(lang), {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}{" "}
                          <span>● Publicado</span>
                        </span>
                        <h3>{e.name}</h3>
                        <p>⌖ {e.venue}</p>
                        <div className="event-footer">
                          <span>
                            Desde <b>{money(e.price)}</b>
                          </span>
                          <button
                            aria-label={`Ver ${e.name}`}
                            onClick={() => open(e)}
                          >
                            ↗
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
              </div>
              {events.filter((e) =>
                `${e.name} ${e.venue}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              ).length === 0 && <p>No encontramos eventos con esa búsqueda.</p>}
              <footer>
                <span>Hecho para crear experiencias extraordinarias.</span>
                <span>Ticketing ↗</span>
              </footer>
            </>
          )}
          {page === "Eventos" && event && (
            <>
              <button className="back" onClick={() => setEvent(null)}>
                ← Volver a eventos
              </button>
              <div className="heading">
                <div>
                  <p className="eyebrow">{event.venue}</p>
                  <h1>{event.name}</h1>
                  <p>
                    {new Date(event.date).toLocaleString(locale(lang))} ·{" "}
                    {event.medium}
                  </p>
                </div>
              </div>
              {order ? (
                <section className="panel">
                  <span className="pill success">
                    Entradas emitidas · Pago simulado
                  </span>
                  <h2>¡Ya tenés tus entradas!</h2>
                  <p>
                    Demo: no se cobró ni se envió correo a {order.email}. Guardá
                    tus entradas o imprimilas.
                  </p>
                  {order.tickets.map((t) => (
                    <Ticket key={t.id} ticket={t} event={event} />
                  ))}
                  <button className="primary" onClick={() => window.print()}>
                    Imprimir entradas
                  </button>
                </section>
              ) : (
                <div className="booking">
                  <section className="seat-panel">
                    <div className="seat-title">
                      <h2>Elegí tu lugar</h2>
                      <span>Máximo 8 entradas</span>
                    </div>
                    <SeatMap
                      event={event}
                      availability={availability}
                      seats={seats}
                      onSelect={choose}
                      lang={lang}
                    />
                    <div className="legend">
                      <span>● Disponible</span>
                      <span>🟢 Tu selección</span>
                      <span>● No disponible</span>
                    </div>
                    <details>
                      <summary>Selección accesible de asientos</summary>
                      <div className="seat-buttons">
                        {Array.from(
                          { length: event.rows * event.columns },
                          (_, i) =>
                            `${String.fromCharCode(65 + Math.floor(i / event.columns))}${(i % event.columns) + 1}`,
                        ).map((id) => (
                          <button
                            key={id}
                            disabled={
                              !!hold ||
                              availability.sold.includes(id) ||
                              availability.held.includes(id)
                            }
                            aria-pressed={seats.includes(id)}
                            onClick={() => choose(id)}
                          >
                            {id}
                          </button>
                        ))}
                      </div>
                    </details>
                  </section>
                  <section className="panel checkout">
                    <h2>Tu experiencia</h2>
                    <label>
                      Canal de venta
                      <select
                        disabled={!!hold}
                        value={channel}
                        onChange={(e) => setChannel(e.target.value)}
                      >
                        {["Web", "Boletería", "Móvil", "Distribuidor"].map(
                          (c) => (
                            <option key={c}>{c}</option>
                          ),
                        )}
                      </select>
                    </label>
                    {channel !== "Web" && (
                      <label>
                        Clave de operador
                        <input
                          type="password"
                          value={key}
                          onChange={(e) => {
                            setKey(e.target.value);
                            sessionStorage.setItem("operator", e.target.value);
                          }}
                        />
                      </label>
                    )}
                    <p>
                      Asientos{" "}
                      <b>{checkoutSeats.join(", ") || "Sin seleccionar"}</b>
                    </p>
                    <div className="total">
                      <span>Total</span>
                      <strong>{money(checkoutTotal)}</strong>
                    </div>
                    {!hold ? (
                      <button
                        disabled={busy || !seats.length}
                        className="primary"
                        onClick={() =>
                          run(async () =>
                            setHold(
                              await api("/holds", "POST", {
                                eventId: event.id,
                                seats,
                                channel,
                              }),
                            ),
                          )
                        }
                      >
                        Reservar por 5 minutos →
                      </button>
                    ) : (
                      <>
                        <p className="timer">
                          Reserva: {Math.floor(seconds / 60)}:
                          {String(seconds % 60).padStart(2, "0")}
                        </p>
                        <label>
                          Nombre del comprador
                          <input
                            value={buyerName}
                            onChange={(e) => setBuyerName(e.target.value)}
                            placeholder="Valentina Robles (ficticio)"
                          />
                        </label>
                        <label>
                          Correo del comprador
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="vos@ejemplo.com"
                          />
                        </label>
                        <label>
                          Método de pago
                          <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                          >
                            <option value="demo_card">Tarjeta simulada</option>
                            <option value="demo_transfer">
                              Transferencia simulada
                            </option>
                          </select>
                        </label>
                        <small>
                          Modo demostración: no ingreses datos de tarjeta, CBU
                          ni comprobantes.
                        </small>
                        <button
                          className="primary"
                          disabled={busy || !seconds || buyerName.trim().length < 2}
                          onClick={() =>
                            run(async () =>
                              setOrder(
                                await api("/checkout", "POST", {
                                  holdId: hold.id,
                                  buyerName,
                                  email,
                                  paymentMethod,
                                }),
                              ),
                            )
                          }
                        >
                          Simular pago y emitir
                        </button>
                        {!seconds && (
                          <button
                            onClick={() => {
                              setHold(null);
                              selection.set("seats", []);
                            }}
                          >
                            Elegir nuevamente
                          </button>
                        )}
                      </>
                    )}
                    <small>
                      Modo demostración. No se realizan cobros reales.
                    </small>
                  </section>
                </div>
              )}
            </>
          )}
          {page !== "Eventos" && (
            <>
              <div className="heading">
                <div>
                  <p className="eyebrow">TU NEGOCIO, CONECTADO</p>
                  <h1>{page}</h1>
                  <p>Gestioná tu operación desde un único espacio.</p>
                </div>
              </div>
              <section className="operator">
                <label>
                  Clave de operador
                  <input
                    type="password"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="Ver terminal del servidor"
                  />
                </label>
                <button onClick={login} disabled={busy}>
                  Ingresar / actualizar
                </button>
                {admin && <span>Sesión verificada</span>}
              </section>
              {page === "Nuevo evento" && (
                <form
                  className="panel form-grid"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const d = Object.fromEntries(new FormData(e.currentTarget));
                    run(async () => {
                      await api("/events", "POST", {
                        ...d,
                        price: Number(d.price),
                        rows: Number(d.rows),
                        columns: Number(d.columns),
                      });
                      await refresh();
                      setPage("Eventos");
                    });
                  }}
                >
                  <label>
                    Nombre
                    <input required name="name" maxLength="120" />
                  </label>
                  <label>
                    Lugar
                    <input required name="venue" />
                  </label>
                  <label>
                    Fecha y hora
                    <input required name="date" type="datetime-local" />
                  </label>
                  <label>
                    Precio ARS
                    <input
                      required
                      name="price"
                      type="number"
                      min="0"
                      max="10000000"
                      defaultValue="15000"
                    />
                  </label>
                  <label>
                    Filas
                    <input
                      name="rows"
                      type="number"
                      min="1"
                      max="20"
                      defaultValue="8"
                    />
                  </label>
                  <label>
                    Columnas
                    <input
                      name="columns"
                      type="number"
                      min="1"
                      max="20"
                      defaultValue="12"
                    />
                  </label>
                  <label>
                    Medio de acceso
                    <select name="medium">
                      <option>Digital</option>
                      <option>Papel</option>
                      <option>RFID</option>
                    </select>
                  </label>
                  <button className="primary" disabled={busy}>
                    Publicar evento
                  </button>
                </form>
              )}
              {page === "Ventas" && (
                <section className="panel">
                  <h2>Ventas de todos tus canales</h2>
                  {admin ? (
                    <>
                      <div className="stats compact">
                        <article>
                          Ingresos demo
                          <b>
                            {money(
                              admin.orders.reduce((sum, o) => sum + o.total, 0),
                            )}
                          </b>
                        </article>
                        <article>
                          Entradas emitidas<b>{admin.tickets}</b>
                        </article>
                        <article>
                          Ingresos al evento<b>{admin.checkedIn}</b>
                        </article>
                      </div>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Comprador</th>
                              <th>Canal</th>
                              <th>Total</th>
                              <th>Pago</th>
                            </tr>
                          </thead>
                          <tbody>
                            {admin.orders.map((o) => (
                              <tr key={o.id}>
                                <td>{o.email}</td>
                                <td>{o.channel}</td>
                                <td>{money(o.total)}</td>
                                <td>
                                  {o.paymentMethodType
                                    ? `DEMO · ${paymentName(o.paymentMethodType, lang)}`
                                    : o.payment}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {!admin.orders.length && (
                        <p>
                          Todavía no hay ventas. Emití una entrada desde
                          Eventos.
                        </p>
                      )}
                    </>
                  ) : (
                    <p>Ingresá tu clave para consultar las ventas.</p>
                  )}
                </section>
              )}
              {page === "Clientes" && (
                <section className="panel">
                  <h2>Base de clientes seudonimizada</h2>
                  <p>Los datos identificatorios permanecen cifrados. Cada revelado queda auditado.</p>
                  {customers ? (
                    <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Compras</th><th>Tickets</th><th>Total</th><th>Datos protegidos</th></tr></thead><tbody>
                      {customers.map((customer) => <tr key={customer.id}><td>{customer.pseudonym}</td><td>{customer.orders}</td><td>{customer.tickets}</td><td>{money(customer.total)}</td><td>{revealed[customer.id] ? <span>{revealed[customer.id].name} · {revealed[customer.id].email}</span> : customer.hasProfile ? <button onClick={() => run(async()=>{const details=await api(`/customers/${customer.id}/reveal`,"POST");setRevealed(current=>({...current,[customer.id]:details}));})}>Revelar y auditar</button> : <span>Sin perfil cifrado</span>}</td></tr>)}
                    </tbody></table></div>
                  ) : <p>Ingresá tu clave para consultar clientes.</p>}
                </section>
              )}
              {page === "Control de acceso" && (
                <form
                  className="panel scan"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setScanResult(null);
                    setScanError("");
                    setBusy(true);
                    api("/scan", "POST", {
                      eventId: scanEvent,
                      token: token.trim(),
                    })
                      .then((result) => {
                        setScanResult(result);
                        setToken("");
                      })
                      .catch((error) => setScanError(error.message))
                      .finally(() => setBusy(false));
                  }}
                >
                  <h2>Validación online</h2>
                  <p>
                    Escaneá el código con un lector USB o pegá el token de la
                    entrada.
                  </p>
                  <label>
                    Evento
                    <select
                      required
                      value={scanEvent}
                      onChange={(e) => setScanEvent(e.target.value)}
                    >
                      <option value="">Elegí un evento</option>
                      {events.map((e) => (
                        <option value={e.id} key={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Código de entrada
                    <input
                      required
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      autoComplete="off"
                    />
                  </label>
                  <button className="primary" disabled={busy}>
                    Validar ingreso →
                  </button>
                  {scanResult && (
                    <div className="accepted" role="status">
                      ✓ Acceso permitido · Asiento {scanResult.seat}
                    </div>
                  )}
                  {scanError && (
                    <div className="alert" role="alert">
                      Acceso rechazado: {scanError}
                    </div>
                  )}
                  <small>
                    Una entrada puede usarse una sola vez. RFID requiere
                    conectar el lector y asociar su identificador.
                  </small>
                </form>
              )}
              {page === "Mi marca" && (
                <form
                  className="panel form-grid"
                  key={brand.name + brand.color}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const d = Object.fromEntries(new FormData(e.currentTarget));
                    run(async () => setBrand(await api("/brand", "PUT", d)));
                  }}
                >
                  <label>
                    Nombre de tu marca
                    <input
                      required
                      name="name"
                      defaultValue={brand.name}
                      maxLength="60"
                    />
                  </label>
                  <label>
                    Color principal
                    <input
                      name="color"
                      type="color"
                      defaultValue={brand.color}
                    />
                  </label>
                  <button className="primary" disabled={busy}>
                    Guardar identidad
                  </button>
                </form>
              )}
              {page === "Integraciones" && (
                <section className="panel">
                  <h2>Conectá tu ecosistema</h2>
                  <p>
                    Registrá los proveedores que necesitás conectar. Esta demo
                    guarda la intención; no conecta servicios externos ni
                    almacena credenciales.
                  </p>
                  <form
                    className="integration-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const d = Object.fromEntries(
                        new FormData(e.currentTarget),
                      );
                      run(async () => {
                        await api("/integrations", "PUT", d);
                        setAdmin(await api("/admin"));
                      });
                    }}
                  >
                    <label>
                      Tipo
                      <select name="type">
                        {[
                          "Pago",
                          "Correo",
                          "Entrega",
                          "Beneficios",
                          "Sitio de venta",
                        ].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Proveedor
                      <input
                        name="provider"
                        required
                        placeholder="Nombre del proveedor"
                        maxLength="80"
                      />
                    </label>
                    <button className="primary" disabled={busy}>
                      Agregar
                    </button>
                  </form>
                  {admin?.integrations.map((i) => (
                    <div className="integration" key={i.id}>
                      <b>{i.provider}</b>
                      <span>{i.type}</span>
                      <small>{i.status}</small>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
